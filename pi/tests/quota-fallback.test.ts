import { describe, expect, it } from "bun:test";
import {
	DEFAULT_EXHAUSTED_MS,
	DEFAULT_FALLBACK_CHAIN,
	exhaustedUntil,
	findQuotaFailure,
	isAllowedForSession,
	orderFallbacks,
	parseQuotaError,
	pickFallback,
} from "../extensions/quota-fallback";

const ZAI_1308 =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-09-08 09:29:08"}';
const now = new Date("2026-09-07T14:30:00");

describe("parseQuotaError", () => {
	it("recognises the Z.ai 1308 body and its local reset time", () => {
		const v = parseQuotaError(ZAI_1308);
		expect(v.quota).toBe(true);
		if (v.quota) expect(v.resetAt).toEqual(new Date("2026-09-08T09:29:08"));
	});

	it("recognises Codex-style wording without a reset time", () => {
		const v = parseQuotaError("Codex error: The usage limit has been reached");
		expect(v.quota).toBe(true);
		if (v.quota) expect(v.resetAt).toBeUndefined();
		expect(parseQuotaError("429 usage_limit_reached").quota).toBe(true);
	});

	it("ignores non-quota errors, including plain 429s", () => {
		expect(parseQuotaError("429: rate limit exceeded, retry in 20s").quota).toBe(false);
		expect(parseQuotaError("503 overloaded").quota).toBe(false);
		expect(parseQuotaError(undefined).quota).toBe(false);
	});
});

describe("exhaustedUntil", () => {
	it("uses the provider's reset time when it is in the future", () => {
		expect(exhaustedUntil(parseQuotaError(ZAI_1308), now)).toEqual(new Date("2026-09-08T09:29:08"));
	});

	it("falls back to 60 minutes when the reset time is missing or unparseable", () => {
		const expected = new Date(now.getTime() + DEFAULT_EXHAUSTED_MS);
		expect(exhaustedUntil(parseQuotaError("Usage limit reached. Your limit will reset at soon"), now)).toEqual(expected);
		expect(exhaustedUntil(parseQuotaError("Usage limit reached for 5 hour"), now)).toEqual(expected);
	});

	it("falls back to 60 minutes when the reported reset time has already passed", () => {
		const past = 'Usage limit reached. Your limit will reset at 2026-09-07 09:00:00';
		expect(exhaustedUntil(parseQuotaError(past), now)).toEqual(new Date(now.getTime() + DEFAULT_EXHAUSTED_MS));
	});
});

describe("orderFallbacks / pickFallback", () => {
	const chain = DEFAULT_FALLBACK_CHAIN;
	const none = new Map<string, Date>();

	it("starts after the current model and never returns it", () => {
		const order = orderFallbacks(chain, { provider: "zai", id: "glm-5.3" }, none, now);
		expect(order.map((e) => e.provider)).toEqual(["openrouter", "google", "openai-codex"]);
	});

	it("wraps around when the current model is mid-chain", () => {
		const order = orderFallbacks(chain, { provider: "google", id: "gemini-flash-latest" }, none, now);
		expect(order.map((e) => e.provider)).toEqual(["openai-codex", "zai", "openrouter"]);
	});

	it("tries the whole chain when the current model is not in it", () => {
		const order = orderFallbacks(chain, { provider: "openrouter", id: "qwen/qwen3.7-flash" }, none, now);
		expect(order).toHaveLength(chain.length);
		expect(order[0]?.provider).toBe("zai");
	});

	it("skips providers still inside their exhausted window", () => {
		const exhausted = new Map([["openrouter", new Date(now.getTime() + 5 * 60_000)]]);
		const pick = pickFallback(chain, { provider: "zai", id: "glm-5.3" }, exhausted, now, () => true);
		expect(pick).toEqual({ provider: "google", id: "gemini-flash-latest" });
	});

	it("uses a provider again once its window has passed", () => {
		const exhausted = new Map([["openrouter", new Date(now.getTime() - 1)]]);
		const pick = pickFallback(chain, { provider: "zai", id: "glm-5.3" }, exhausted, now, () => true);
		expect(pick).toEqual({ provider: "openrouter", id: "deepseek/deepseek-v4-pro" });
	});

	it("returns undefined when nothing is available", () => {
		expect(pickFallback(chain, undefined, none, now, () => false)).toBeUndefined();
		expect(orderFallbacks([], undefined, none, now)).toEqual([]);
	});
});

describe("isAllowedForSession", () => {
	const pro = { provider: "openrouter", id: "deepseek/deepseek-v4-pro", cost: { input: 1.2, output: 3, cacheRead: 0, cacheWrite: 0 } };
	const flash = { provider: "openrouter", id: "deepseek/deepseek-v4-flash", cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 } };

	it("lets a direct session fall to any model", () => {
		expect(isAllowedForSession(pro, false)).toBe(true);
	});

	it("keeps a delegated worker inside the cheap OpenRouter allowlist", () => {
		expect(isAllowedForSession(pro, true)).toBe(false);
		expect(isAllowedForSession(flash, true)).toBe(true);
		expect(isAllowedForSession({ provider: "openai-codex", id: "gpt-5.6-terra", cost: flash.cost }, true)).toBe(true);
	});
});

describe("findQuotaFailure", () => {
	it("finds the failed assistant message at the end of a run", () => {
		const messages = [
			{ role: "user" },
			{ role: "assistant", stopReason: "error", errorMessage: ZAI_1308, provider: "zai", model: "glm-5.3" },
		];
		const f = findQuotaFailure(messages);
		expect(f?.message.provider).toBe("zai");
		expect(f?.verdict.resetAt).toEqual(new Date("2026-09-08T09:29:08"));
	});

	it("ignores runs that ended normally or with a non-quota error", () => {
		expect(findQuotaFailure([{ role: "assistant", stopReason: "stop" }])).toBeUndefined();
		expect(findQuotaFailure([{ role: "assistant", stopReason: "error", errorMessage: "503 overloaded" }])).toBeUndefined();
		expect(findQuotaFailure([{ role: "user" }])).toBeUndefined();
	});
});
