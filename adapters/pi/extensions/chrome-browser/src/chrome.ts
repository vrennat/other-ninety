import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import {
	DEBUG_URL,
	PROFILE_DIR,
	STARTUP_LOCK_DIR,
	STARTUP_TIMEOUT_MS,
	getChromeArguments,
	getChromeCandidates,
	getSafeProcessEnvironment,
} from "./config.ts";

const POLL_INTERVAL_MS = 200;
const STALE_LOCK_MS = STARTUP_TIMEOUT_MS * 2;

interface DevToolsVersion {
	Browser?: unknown;
	webSocketDebuggerUrl?: unknown;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

function sleep(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export async function isChromeReachable(): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1_000);

	try {
		const response = await fetch(`${DEBUG_URL}/json/version`, { signal: controller.signal });
		if (!response.ok) return false;
		const version = await response.json() as DevToolsVersion;
		return typeof version.Browser === "string" &&
			typeof version.webSocketDebuggerUrl === "string";
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForChrome(timeoutMs = STARTUP_TIMEOUT_MS): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await isChromeReachable()) return true;
		await sleep(POLL_INTERVAL_MS);
	}
	return false;
}

async function removeStaleLock(): Promise<void> {
	try {
		const lock = await stat(STARTUP_LOCK_DIR);
		if (Date.now() - lock.mtimeMs > STALE_LOCK_MS) {
			await rm(STARTUP_LOCK_DIR, { recursive: true, force: true });
		}
	} catch (error) {
		if (!isNodeError(error) || error.code !== "ENOENT") throw error;
	}
}

async function acquireStartupLock(): Promise<boolean> {
	await mkdir(PROFILE_DIR, { recursive: true });
	await removeStaleLock();
	try {
		await mkdir(STARTUP_LOCK_DIR);
		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === "EEXIST") return false;
		throw error;
	}
}

async function spawnChrome(candidate: string): Promise<ChildProcess> {
	return await new Promise((resolve, reject) => {
		const child = spawn(candidate, getChromeArguments(), {
			detached: true,
			stdio: "ignore",
			env: getSafeProcessEnvironment(),
		});
		child.once("spawn", () => {
			child.unref();
			resolve(child);
		});
		child.once("error", reject);
	});
}

async function launchChrome(): Promise<void> {
	const failures: string[] = [];
	for (const candidate of getChromeCandidates()) {
		try {
			const child = await spawnChrome(candidate);
			if (await waitForChrome()) return;
			child.kill("SIGTERM");
			failures.push(`${candidate}: debugging endpoint did not open`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${candidate}: ${message}`);
		}
	}

	throw new Error(
		`Unable to start Chrome for Pi. Set PI_CHROME_PATH if Chrome is installed elsewhere. ${failures.join("; ")}`,
	);
}

export async function ensureChromeRunning(): Promise<void> {
	if (await isChromeReachable()) return;

	const hasLock = await acquireStartupLock();
	if (!hasLock) {
		if (await waitForChrome()) return;
		throw new Error(
			`Chrome startup did not complete within ${STARTUP_TIMEOUT_MS}ms. Another browser tool or Pi session may have failed to launch it.`,
		);
	}

	try {
		if (await isChromeReachable()) return;
		await launchChrome();
	} finally {
		await rm(STARTUP_LOCK_DIR, { recursive: true, force: true });
	}
}
