import { access } from "node:fs/promises";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { isChromeReachable } from "./chrome.ts";
import { DEBUG_URL, PROFILE_DIR } from "./config.ts";
import type { BrowserMcpClient } from "./mcp-client.ts";

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function showBrowserStatus(
	ctx: ExtensionCommandContext,
	client: BrowserMcpClient,
): Promise<void> {
	const [hasProfile, isReachable] = await Promise.all([
		pathExists(PROFILE_DIR),
		isChromeReachable(),
	]);
	ctx.ui.notify(
		[
			`Profile: ${PROFILE_DIR} (${hasProfile ? "created" : "not created"})`,
			`Chrome endpoint: ${DEBUG_URL} (${isReachable ? "reachable" : "stopped"})`,
			`MCP subprocess: ${client.isConnected() ? "connected" : "stopped"}`,
		].join("\n"),
		isReachable ? "info" : "warning",
	);
}
