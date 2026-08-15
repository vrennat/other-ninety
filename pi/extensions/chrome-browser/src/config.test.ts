import { describe, expect, test } from "bun:test";
import {
	DEBUG_URL,
	getChromeCandidates,
	getMcpArguments,
	getSafeProcessEnvironment,
	prefixToolName,
	shouldExcludeTool,
} from "./config.ts";

describe("browser configuration", () => {
	test("excludes high-noise and privileged tool categories", () => {
		const names = [
			"performance_start_trace",
			"lighthouse_audit",
			"screencast_start",
			"take_heapsnapshot",
			"install_extension",
			"list_extensions",
			"execute_3p_developer_tool",
			"execute_webmcp_tool",
		];
		expect(names.every(shouldExcludeTool)).toBe(true);
	});

	test("keeps normal browsing and debugging tools", () => {
		const names = ["click", "fill", "navigate_page", "take_snapshot", "evaluate_script", "list_network_requests"];
		expect(names.every((name) => !shouldExcludeTool(name))).toBe(true);
	});

	test("prefixes tool names once", () => {
		expect(prefixToolName("click")).toBe("browser_click");
		expect(prefixToolName("browser_click")).toBe("browser_click");
	});

	test("uses an explicit Chrome override exclusively", () => {
		expect(getChromeCandidates("linux", "/home/test", "/opt/chrome")).toEqual(["/opt/chrome"]);
	});

	test("resolves platform-specific Chrome candidates", () => {
		expect(getChromeCandidates("darwin", "/Users/test", undefined)[0]).toContain("Google Chrome.app");
		expect(getChromeCandidates("linux", "/home/test", undefined)).toContain("google-chrome");
		expect(getChromeCandidates("win32", "C:\\Users\\test", undefined).at(-1)).toBe("chrome.exe");
	});

	test("pins MCP to the shared debugging endpoint with privacy flags", () => {
		const args = getMcpArguments("/local/chrome-devtools-mcp.js");
		expect(args).toContain(`--browser-url=${DEBUG_URL}`);
		expect(args).toContain("--no-usage-statistics");
		expect(args).toContain("--no-performance-crux");
		expect(args).toContain("--redact-network-headers");
		expect(args).toContain("--experimental-page-id-routing");
	});

	test("does not pass API keys to browser child processes", () => {
		const environment = getSafeProcessEnvironment({
			HOME: "/Users/test",
			PATH: "/usr/bin",
			OPENAI_API_KEY: "should-not-pass-through",
		});
		expect(environment).toEqual({ HOME: "/Users/test", PATH: "/usr/bin" });
	});
});
