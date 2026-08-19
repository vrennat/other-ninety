import { describe, expect, test } from "bun:test";
import { shouldShowStatus } from "../extensions/compact-footer";

describe("compact footer statuses", () => {
	test("hides the adapter's persistent MCP status", () => {
		expect(shouldShowStatus("mcp")).toBe(false);
	});

	test("keeps the actionable MCP health status", () => {
		expect(shouldShowStatus("mcp-health")).toBe(true);
		expect(shouldShowStatus("openai-fast-mode")).toBe(true);
	});
});
