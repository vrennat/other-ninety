import { describe, expect, test } from "bun:test";
import { describeMcpProblem, formatMcpHealth } from "../extensions/mcp-health";

const server = (name: string, status: string, extra: Record<string, unknown> = {}) => ({ name, status, ...extra });

describe("MCP health", () => {
	test("stays silent for healthy lazy connections", () => {
		expect(formatMcpHealth({
			servers: [server("linear", "connected"), server("github", "cached"), server("idle", "not-connected")],
		})).toBeUndefined();
	});

	test("names every unhealthy server", () => {
		expect(formatMcpHealth({
			servers: [
				server("linear", "failed", { failedAgoSeconds: 12 }),
				server("github", "needs-auth"),
			],
		})).toBe("MCP: linear failed 12s ago, github needs auth");
	});

	test("surfaces unknown states and rejects invalid ages", () => {
		expect(formatMcpHealth({ servers: [server("linear", "changed-state")] })).toBe("MCP: linear changed-state");
		expect(describeMcpProblem({ name: "linear", status: "failed", failedAgoSeconds: -1 })).toBe("linear failed");
	});

	test("ignores malformed and disabled entries", () => {
		expect(formatMcpHealth({ servers: [null, {}, server("linear", "failed", { disabled: true })] })).toBeUndefined();
		expect(formatMcpHealth({ servers: "invalid" })).toBeUndefined();
	});
});
