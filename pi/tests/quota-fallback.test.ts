import { describe, expect, it } from "bun:test";
import { DEFAULT_FALLBACK_CHAIN, parseQuotaError, pickFallback } from "../extensions/quota-fallback";
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

	it("handles unparseable reset timestamp grace period (60-minute default)", () => {
		// A quota error with a timestamp format we can't parse — returns resetAt undefined
		const result = parseQuotaError(
			'429: Usage limit reached. Resets at some unknown time.',
		);
		expect(result.quota).toBe(true);
		if (result.quota) expect(result.resetAt).toBeUndefined();
	});
});

describe("pickFallback", () => {
	const chain: ChainEntry[] = [
		{ provider: "zai", id: "glm-5.3" },
		{ provider: "openrouter", id: "deepseek/deepseek-v4-pro" },
		{ provider: "google", id: "gemini-flash-latest" },
		{ provider: "openai-codex", id: "gpt-5.6-terra" },
	];

	const alwaysAvailable: (entry: ChainEntry) => boolean = () => true;
	const now = new Date("2026-09-08T10:00:00");

	it("returns the next entry after the current model", () => {
		const result = pickFallback(
			chain,
			{ provider: "zai", id: "glm-5.3" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toEqual({ provider: "openrouter", id: "deepseek/deepseek-v4-pro" });
	});

	it("wraps around when current model is the last entry", () => {
		const result = pickFallback(
			chain,
			{ provider: "openai-codex", id: "gpt-5.6-terra" },
			{},
			now,
			alwaysAvailable,
		);
		expect(result).toEqual({ provider: "zai", id: "glm-5.3" });
	});

	it("skips an exhausted provider and picks the next", () => {
		const exhaustedAt = new Date("2026-09-08T12:00:00"); // still in the future
		const result = pickFallback(
			chain,
			{ provider: "zai", id: "glm-5.3" },
			{ openrouter: exhaustedAt },
			now,
			alwaysAvailable,
		);
		// Skips openrouter, picks google
		expect(result).toEqual({ provider: "google", id: "gemini-flash-latest" });
	});

	it("skips an entry that is not available in the registry", () => {
		const result = pickFallback(
			chain,
			{ provider: "zai", id: "glm-5.3" },
			{},
			now,
			(entry) => entry.provider !== "openrouter",
		);
		expect(result).toEqual({ provider: "google", id: "gemini-flash-latest" });
	});

	it("skips an OpenRouter model not allowed by delegated policy", () => {
		const result = pickFallback(
			chain,
			{ provider: "zai", id: "glm-5.3" },
			{},
			now,
			(entry) => {
				// Simulate isDelegatedModelAllowed returning false for this OpenRouter model
				if (entry.provider === "openrouter") return false;
				return true;
			},
		);
		// Skips openrouter/deepseek/deepseek-v4-pro, picks google
		expect(result).toEqual({ provider: "google", id: "gemini-flash-latest" });
	});

	it("returns undefined when all entries are exhausted or unavailable", () => {
		const exhaustedUntil: Record<string, Date | undefined> = {
			zai: new Date("2026-09-08T12:00:00"),
			openrouter: new Date("2026-09-08T12:00:00"),
			google: new Date("2026-09-08T12:00:00"),
			"openai-codex": new Date("2026-09-08T12:00:00"),
		};
		const result = pickFallback(chain, { provider: "zai", id: "glm-5.3" }, exhaustedUntil, now, alwaysAvailable);
		expect(result).toBeUndefined();
	});

	it("returns undefined for an empty chain", () => {
		const result = pickFallback([], { provider: "zai", id: "glm-5.3" }, {}, now, alwaysAvailable);
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
		expect(result).toEqual({ provider: "zai", id: "glm-5.3" });
	});

	it("skips the current model even when it wraps around", () => {
		// If only one entry is available and it's the current model, return undefined
		const singleChain: ChainEntry[] = [{ provider: "zai", id: "glm-5.3" }];
		const result = pickFallback(
			singleChain,
			{ provider: "zai", id: "glm-5.3" },
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
			{ provider: "zai", id: "glm-5.3" },
			{ openrouter: exhaustedAt },
			new Date("2026-09-08T10:00:00"),
			alwaysAvailable,
		);
		// openrouter is no longer exhausted, so it's available
		expect(result).toEqual({ provider: "openrouter", id: "deepseek/deepseek-v4-pro" });
	});
});

describe("DEFAULT_FALLBACK_CHAIN", () => {
	it("has the expected entries in order", () => {
		expect(DEFAULT_FALLBACK_CHAIN).toEqual([
			{ provider: "zai", id: "glm-5.3" },
			{ provider: "openrouter", id: "deepseek/deepseek-v4-pro" },
			{ provider: "google", id: "gemini-flash-latest" },
			{ provider: "openai-codex", id: "gpt-5.6-terra" },
		]);
	});
});