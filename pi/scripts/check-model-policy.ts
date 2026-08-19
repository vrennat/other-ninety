import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CHEAP_OPENROUTER_MODELS } from "../extensions/model-policy";

const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function splitThinking(route: string): string {
	const colon = route.lastIndexOf(":");
	if (colon === -1) return route;
	return THINKING_LEVELS.has(route.slice(colon + 1)) ? route.slice(0, colon) : route;
}

function checkRoute(route: string, source: string, failures: string[]) {
	const normalized = splitThinking(route);
	if (!normalized.startsWith("openrouter/")) return;
	const id = normalized.slice("openrouter/".length);
	if (!CHEAP_OPENROUTER_MODELS.has(id)) {
		failures.push(`${source}: disallowed OpenRouter route ${route}`);
	}
}

async function main() {
	const settingsPath = process.argv[2];
	const agentsDir = process.argv[3];
	if (!settingsPath || !agentsDir) {
		throw new Error("usage: bun scripts/check-model-policy.ts <settings.json> <agents-dir>");
	}

	const failures: string[] = [];
	const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
		defaultProvider?: string;
		defaultModel?: string;
		enabledModels?: string[];
	};
	if (settings.defaultProvider && settings.defaultModel) {
		checkRoute(`${settings.defaultProvider}/${settings.defaultModel}`, settingsPath, failures);
	}
	for (const route of settings.enabledModels ?? []) checkRoute(route, settingsPath, failures);

	for (const name of (await readdir(agentsDir)).filter((entry) => entry.endsWith(".md")).sort()) {
		const path = join(agentsDir, name);
		const text = await readFile(path, "utf8");
		const match = text.match(/^model:\s*(\S+)\s*$/m);
		if (!match?.[1]) failures.push(`${path}: missing model route`);
		else checkRoute(match[1], path, failures);
	}

	if (failures.length > 0) {
		for (const failure of failures) console.error(failure);
		process.exitCode = 1;
		return;
	}
	console.log(`model policy OK: ${CHEAP_OPENROUTER_MODELS.size} approved OpenRouter routes`);
}

await main();
