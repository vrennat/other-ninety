import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ensureChromeRunning } from "./src/chrome.ts";
import { buildToolDescription, convertMcpContent, getErrorMessage } from "./src/content.ts";
import { prefixToolName, shouldExcludeTool } from "./src/config.ts";
import { BrowserMcpClient } from "./src/mcp-client.ts";
import { showBrowserStatus } from "./src/status-command.ts";

export default function chromeBrowserExtension(pi: ExtensionAPI): void {
	const client = new BrowserMcpClient();
	let browserToolNames: string[] = [];
	let registration: Promise<string[]> | undefined;

	async function registerBrowserTools(): Promise<string[]> {
		if (browserToolNames.length > 0) return browserToolNames;
		if (registration) return registration;

		registration = (async () => {
			const tools = await client.listTools();
			const availableTools = tools.filter((candidate) => !shouldExcludeTool(candidate.name));
			for (const tool of availableTools) {
				pi.registerTool({
					name: prefixToolName(tool.name),
					label: tool.name,
					description: buildToolDescription(tool.name, tool.description),
					parameters: Type.Unsafe<Record<string, unknown>>(tool.inputSchema),
					async execute(_toolCallId, params, signal) {
						await ensureChromeRunning();
						const result = await client.callTool(tool.name, params, signal);
						const content = convertMcpContent(tool.name, result.content);
						if (result.isError) throw new Error(getErrorMessage(tool.name, content));
						return { content, details: { upstreamTool: tool.name } };
					},
				});
			}

			browserToolNames = availableTools.map((tool) => prefixToolName(tool.name));
			return browserToolNames;
		})();

		try {
			return await registration;
		} finally {
			registration = undefined;
		}
	}

	pi.registerTool({
		name: "browser_tools",
		label: "Load browser tools",
		description: "Load Chrome browser automation and debugging tools when a task requires browser interaction.",
		promptSnippet: "Load Chrome browser tools on demand",
		parameters: Type.Object({}),
		async execute() {
			const names = await registerBrowserTools();
			pi.setActiveTools([...new Set([...pi.getActiveTools(), ...names])]);
			return {
				content: [{ type: "text", text: `Loaded ${names.length} browser tools.` }],
				details: { added: names },
			};
		},
	});

	pi.registerCommand("browser-status", {
		description: "Show the dedicated Pi Chrome profile and connection status",
		handler: async (_args, ctx) => showBrowserStatus(ctx, client),
	});

	pi.on("session_shutdown", async () => {
		await client.close();
	});
}
