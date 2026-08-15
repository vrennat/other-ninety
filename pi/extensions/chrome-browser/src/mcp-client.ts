import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import type { Readable } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult, ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { getMcpArguments, getSafeProcessEnvironment } from "./config.ts";

const MCP_TIMEOUT_MS = 60_000;

export interface McpTool {
	name: string;
	description?: string;
	inputSchema: {
		type: "object";
		properties?: Record<string, object>;
		required?: string[];
		[key: string]: unknown;
	};
}

function resolveServerPath(): string {
	const require = createRequire(import.meta.url);
	const packagePath = require.resolve("chrome-devtools-mcp/package.json");
	return join(dirname(packagePath), "build", "src", "bin", "chrome-devtools-mcp.js");
}

function getServerEnvironment(): Record<string, string> {
	return {
		...getSafeProcessEnvironment(),
		CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
		CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
	};
}

function getNodeExecutable(): string {
	return basename(process.execPath).toLowerCase().startsWith("node") ? process.execPath : "node";
}

export class BrowserMcpClient {
	private client: Client | undefined;
	private connection: Promise<void> | undefined;

	isConnected(): boolean {
		return this.client !== undefined;
	}

	async connect(): Promise<void> {
		if (this.client) return;
		if (this.connection) return this.connection;

		this.connection = this.openConnection();
		try {
			await this.connection;
		} finally {
			this.connection = undefined;
		}
	}

	private async openConnection(): Promise<void> {
		const serverPath = resolveServerPath();
		const transport = new StdioClientTransport({
			command: getNodeExecutable(),
			args: getMcpArguments(serverPath),
			env: getServerEnvironment(),
			stderr: "pipe",
		});

		// The server prints a disclaimer on every start. Drain stderr so repeated Pi
		// sessions stay quiet and the child cannot block on a full pipe.
		(transport.stderr as Readable | null)?.resume();

		const client = new Client(
			{ name: "pi-chrome-browser", version: "1.0.0" },
			{ capabilities: {} },
		);
		await client.connect(transport, { timeout: MCP_TIMEOUT_MS });
		this.client = client;
	}

	async listTools(): Promise<McpTool[]> {
		await this.connect();
		if (!this.client) throw new Error("Chrome MCP client failed to connect.");

		const tools: McpTool[] = [];
		let cursor: string | undefined;
		do {
			const result = await this.client.listTools(
				cursor ? { cursor } : undefined,
				{ timeout: MCP_TIMEOUT_MS },
			);
			tools.push(...result.tools as McpTool[]);
			cursor = result.nextCursor;
		} while (cursor);
		return tools;
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<CallToolResult> {
		await this.connect();
		if (!this.client) throw new Error("Chrome MCP client failed to connect.");

		return await this.client.callTool(
			{ name, arguments: args },
			undefined,
			{ signal, timeout: MCP_TIMEOUT_MS },
		) as CallToolResult;
	}

	async close(): Promise<void> {
		const client = this.client;
		if (!client) return;
		try {
			await client.close();
		} finally {
			this.client = undefined;
		}
	}
}

export type { ContentBlock };
