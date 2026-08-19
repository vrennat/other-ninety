import { describe, expect, test } from "bun:test";
import { computeCacheMetrics, formatCacheMetrics } from "../extensions/cache-metrics";

function assistant(input: number, cacheRead = 0, cacheWrite = 0) {
	return { type: "message", message: { role: "assistant", usage: { input, cacheRead, cacheWrite } } };
}

describe("cache metrics", () => {
	test("stays hidden until the provider reports cache telemetry", () => {
		expect(computeCacheMetrics([assistant(10_000)])).toBeUndefined();
	});

	test("reports latest and session cache-read percentages", () => {
		const metrics = computeCacheMetrics([
			assistant(8_000, 0, 2_000),
			assistant(1_000, 9_000),
		]);
		expect(metrics).toEqual({ latestPercent: 90, sessionPercent: 45 });
		expect(formatCacheMetrics(metrics)).toBe("cache 90/45%");
	});

	test("ignores nested and malformed usage", () => {
		const metrics = computeCacheMetrics([
			assistant(1_000, 9_000),
			{ type: "compaction", usage: { input: 10_000, cacheRead: 0, cacheWrite: 0 } },
			assistant(Number.NaN),
		]);
		expect(metrics).toEqual({ latestPercent: 90, sessionPercent: 90 });
	});
});
