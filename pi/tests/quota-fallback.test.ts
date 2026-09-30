import { afterEach, describe, expect, it } from "bun:test";
import quotaFallback, { loadFallbackChain, parseQuotaError, pickFallback } from "../extensions/quota-fallback";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ChainEntry } from "../extensions/quota-fallback";

const EXACT_1308_BODY =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-09-08 09:29:08"}';

describe("parseQuotaError", () => {
	it("detects the exact Z.ai 1308 quota body", () => {
		const result = parseQuotaError(EXACT_1308_BODY);
		expect(result.quota).toBe(true);
		if (result.quota) {
			expect(result.resetAt).toBeInstanceOf(Date);
			// Local-time interpretation: Sep 8 2026 @ 09:29:08
			expect(result.resetAt!.getFullYear()).toBe(2026);
			expect(result.resetAt!.getMonth()).toBe(8); // September (0-indexed)
			expect(result.resetAt!.getDate()).toBe(8);
			expect(result.resetAt!.getHours()).toBe(9);
			expect(result.resetAt!.getMinutes()).toBe(29);
		}
	});

	it("detects usage_limit_reached error code", () => {
		const result = parseQuotaError('429: {"error":"usage_limit_reached","message":"free tier limit"}');
		expect(result.quota).toBe(true);
		if (result.quota) expect(result.resetAt).toBeUndefined();
	});

	it("does NOT match a generic 429 rate limit without quota phrases", () => {
		const result = parseQuotaError("429: Too Many Requests");
		expect(result.quota).toBe(false);
	});

	it("does NOT match a generic 429 JSON error without quota phrases", () => {
		const result = parseQuotaError('429: {"error":"rate_limit_exceeded","message":"slow down"}');
		expect(result.quota).toBe(false);
	});

	it("does NOT match 5xx errors or overloaded messages", () => {
		expect(parseQuotaError("503: Service Unavailable").quota).toBe(false);
		expect(parseQuotaError("overloaded: try again later").quota).toBe(false);
		expect(parseQuotaError("500: Internal Server Error").quota).toBe(false);
	});

	it("returns resetAt as undefined when quota phrase is present but no reset timestamp", () => {
		const result = parseQuotaError('429: {"code":"1308","message":"Usage limit reached, no reset info"}');
		expect(result.quota).toBe(true);
		if (result.quota) expect(result.resetAt).toBeUndefined();
	});

	it("handles Usage limit reached with reset at timestamp", () => {
		const result = parseQuotaError(
			'429: Usage limit reached. Will reset at 2026-12-01 14:00:00',
		);
		expect(result.quota).toBe(true);
		if (result.quota) {
			expect(result.resetAt!.getFullYear()).toBe(2026);
			expect(result.resetAt!.getMonth()).toBe(11); // December
			expect(result.resetAt!.getDate()).toBe(1);
			expect(result.resetAt!.getHours()).toBe(14);
		}
	});

	it("handles unparseable reset timestamp (returns resetAt undefined for 60-min default)", () => {
		const result = parseQuotaError(
			'429: Usage limit reached. Resets at some unknown time.',
		);
		expect(result.quota).toBe(true);
		if (result.quota) expect(result.resetAt).toBeUndefined();
	});
});

describe("pickFallback", () => {
	const chain: ChainEntry[] = [
		{ provider: "alpha", id: "first" },
		{ provider: "beta", id: "second" },
		{ provider: "gamma", id: "third" },
		{ provider: "delta", id: "fourth" },
	];

	const alwaysAvailable: (entry: ChainEntry) => boolean = () => true;
	const now = new Date("2026-09-08T10:00:00");

	it("returns the next entry after the current model", () => {
		const result = pickFallback(
			chain,
			{ provider: "alpha", id: "first" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toEqual({ provider: "beta", id: "second" });
	});

	it("wraps around when current model is the last entry", () => {
		const result = pickFallback(
			chain,
			{ provider: "delta", id: "fourth" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toEqual({ provider: "alpha", id: "first" });
	});

	it("skips an exhausted provider and picks the next", () => {
		const exhaustedAt = new Date("2026-09-08T12:00:00"); // still in the future
		const result = pickFallback(
			chain,
			{ provider: "alpha", id: "first" },
			{ beta: exhaustedAt },
			now,
			alwaysAvailable,
		);
		// Skips beta, picks gamma
		expect(result).toEqual({ provider: "gamma", id: "third" });
	});

	it("skips an entry that is not available in the registry", () => {
		const result = pickFallback(
			chain,
			{ provider: "alpha", id: "first" },
			{},
			now,
			(entry) => entry.provider !== "beta",
		);
		expect(result).toEqual({ provider: "gamma", id: "third" });
	});

	it("skips an OpenRouter model not allowed by delegated policy", () => {
		const result = pickFallback(
			chain,
			{ provider: "alpha", id: "first" },
			{},
			now,
			(entry) => {
				// Simulate isDelegatedModelAllowed returning false for this OpenRouter model
				if (entry.provider === "beta") return false;
				return true;
			},
		);
		// Skips beta/second, picks gamma
		expect(result).toEqual({ provider: "gamma", id: "third" });
	});

	it("returns undefined when all entries are exhausted or unavailable", () => {
		const exhaustedUntil: Record<string, Date | undefined> = {
			alpha: new Date("2026-09-08T12:00:00"),
			beta: new Date("2026-09-08T12:00:00"),
			gamma: new Date("2026-09-08T12:00:00"),
			"delta": new Date("2026-09-08T12:00:00"),
		};
		const result = pickFallback(chain, { provider: "alpha", id: "first" }, exhaustedUntil, now, alwaysAvailable);
		expect(result).toBeUndefined();
	});

	it("returns undefined for an empty chain", () => {
		const result = pickFallback([], { provider: "alpha", id: "first" }, {}, now, alwaysAvailable);
		expect(result).toBeUndefined();
	});

	it("starts from the beginning when current model is not in the chain", () => {
		const result = pickFallback(
			chain,
			{ provider: "unknown", id: "foo" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toEqual({ provider: "alpha", id: "first" });
	});

	it("skips the current model even when it wraps around", () => {
		// If only one entry is available and it's the current model, return undefined
		const singleChain: ChainEntry[] = [{ provider: "alpha", id: "first" }];
		const result = pickFallback(
			singleChain,
			{ provider: "alpha", id: "first" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toBeUndefined();
	});

	it("allows an exhausted entry whose reset time has passed", () => {
		const exhaustedAt = new Date("2026-09-08T09:00:00"); // already passed
		const result = pickFallback(
			chain,
			{ provider: "alpha", id: "first" },
			{ beta: exhaustedAt },
			new Date("2026-09-08T10:00:00"),
			alwaysAvailable,
		);
		// beta is no longer exhausted, so it's available
		expect(result).toEqual({ provider: "beta", id: "second" });
	});
});


const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalDelegated = process.env.OTHER_NINETY_PI_LEAF;
const tempDirs: string[] = [];
afterEach(() => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	if (originalDelegated === undefined) delete process.env.OTHER_NINETY_PI_LEAF;
	else process.env.OTHER_NINETY_PI_LEAF = originalDelegated;
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
});
function config(source?: string) {
	const dir = mkdtempSync(join(tmpdir(), "o90-fallback-"));
	tempDirs.push(dir);
	process.env.PI_CODING_AGENT_DIR = dir;
	if (source !== undefined) writeFileSync(join(dir, "quota-fallback.json"), source);
}
const routes = [
	{ provider: "alpha", id: "first" },
	{ provider: "beta", id: "second" },
	{ provider: "gamma", id: "third" },
];
type Handler = (event: unknown, ctx: ExtensionContext) => Promise<unknown>;
function harness(change = true, unavailable: string[] = []) {
	const handlers: Record<string, Handler> = {};
	const actions: string[] = [];
	const model = (entry: ChainEntry) => ({ ...entry, cost: { input: 1, output: 1 } });
	const ctx = {
		model: model(routes[0]),
		modelRegistry: { find: (provider: string, id: string) =>
			unavailable.includes(provider) ? undefined : model({ provider, id }) },
		ui: { notify: (message: string) => actions.push(message) },
	} as unknown as ExtensionContext;
	const pi = {
		on: (name: string, handler: Handler) => { handlers[name] = handler; },
		setModel: async (next: ChainEntry) => {
			actions.push(`set:${next.provider}/${next.id}`);
			if (change) ctx.model = model(next) as typeof ctx.model;
			return change;
		},
		sendUserMessage: async () => { actions.push("continue"); },
	} as unknown as ExtensionAPI;
	quotaFallback(pi);
	return { handlers, ctx, actions, end: async (errorMessage = "usage_limit_reached") => {
		await handlers.agent_end?.({ messages: [{ role: "assistant", stopReason: "error", errorMessage }] }, ctx);
	} };
}
describe("configured quota fallback", () => {
	it("reads the runtime directory and preserves order", () => {
		config(JSON.stringify(routes));
		expect(loadFallbackChain()).toEqual(routes);
	});
	it("does not substitute without config or with an empty chain", async () => {
		for (const source of [undefined, "[]"]) {
			config(source);
			const run = harness();
			await run.end();
			expect(run.actions).toEqual([]);
		}
	});
	it("disables malformed config with a diagnostic", async () => {
		for (const source of ["{", "{}", '[{"provider":"alpha"}]', '[{"provider":" ","id":"first"}]']) {
			config(source);
			expect(() => loadFallbackChain()).toThrow();
			const run = harness();
			await run.handlers.session_start({}, run.ctx);
			await run.end();
			expect(run.actions).toHaveLength(1);
			expect(run.actions[0]).toContain("Quota fallback disabled:");
		}
	});
	it("switches before announcing success and queues continuation", async () => {
		config(JSON.stringify(routes));
		const run = harness();
		await run.end();
		expect(run.actions[0]).toBe("set:beta/second");
		expect(run.actions[1]).toContain("switched to beta/second");
		expect(run.actions[2]).toBe("continue");
	});
	it("does not announce success or continue on credential failure", async () => {
		config(JSON.stringify(routes));
		const run = harness(false);
		await run.end();
		expect(run.actions).toEqual(["set:beta/second", "No credential for fallback model beta/second."]);
	});
	it("ignores transient rate limits and skips missing models", async () => {
		config(JSON.stringify(routes));
		const run = harness(true, ["beta"]);
		await run.end("429: Too Many Requests");
		expect(run.actions).toEqual([]);
		await run.end();
		expect(run.actions[0]).toBe("set:gamma/third");
	});
	it("stops once every provider is exhausted", async () => {
		config(JSON.stringify(routes));
		const run = harness();
		await run.end();
		await run.end();
		await run.end();
		expect(run.actions.filter((action) => action === "continue")).toHaveLength(2);
		expect(run.actions.at(-1)).toContain("no usable fallback model");
	});
	it("honors delegated restrictions before selecting a configured route", async () => {
		config(JSON.stringify([routes[0], { provider: "openrouter", id: "premium" }, routes[2]]));
		process.env.OTHER_NINETY_PI_LEAF = "1";
		const run = harness();
		await run.end();
		expect(run.actions[0]).toBe("set:gamma/third");
	});
});
