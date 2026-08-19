import { describe, expect, it } from "bun:test";
import {
	CHEAP_OPENROUTER_MODELS,
	DELEGATED_PI_ENV,
	FALLBACK_MODEL,
	OPENROUTER_PRICE_CAP_USD_PER_MILLION,
	isDelegatedModelAllowed,
	isDelegatedPi,
} from "../extensions/model-policy";

const cheapCost = { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 };

describe("Pi model policy", () => {
	it("activates only for marked cross-harness workers", () => {
		expect(isDelegatedPi({})).toBe(false);
		expect(isDelegatedPi({ [DELEGATED_PI_ENV]: "0" })).toBe(false);
		expect(isDelegatedPi({ [DELEGATED_PI_ENV]: "1" })).toBe(true);
	});

	it("allows the approved cheap OpenRouter routes", () => {
		expect([...CHEAP_OPENROUTER_MODELS].sort()).toEqual([
			"deepseek/deepseek-v4-flash",
			"openai/gpt-oss-120b",
			"openai/gpt-oss-20b",
			"poolside/laguna-s-2.1",
			"poolside/laguna-xs-2.1",
			"qwen/qwen3-coder-30b-a3b-instruct",
			"qwen/qwen3.7-flash",
		]);
		for (const id of CHEAP_OPENROUTER_MODELS) {
			expect(isDelegatedModelAllowed({ provider: "openrouter", id, cost: cheapCost })).toBe(true);
		}
	});

	it("blocks premium and moving OpenRouter aliases", () => {
		for (const id of [
			"~anthropic/claude-haiku-latest",
			"~google/gemini-flash-latest",
			"~moonshotai/kimi-latest",
			"~openai/gpt-latest",
			"moonshotai/kimi-k3",
			"qwen/qwen3.8-27b",
		]) {
			expect(isDelegatedModelAllowed({ provider: "openrouter", id, cost: cheapCost })).toBe(false);
		}
	});

	it("blocks an approved route when its catalog price exceeds the cheap ceiling", () => {
		expect(
			isDelegatedModelAllowed({
				provider: "openrouter",
				id: "qwen/qwen3.7-flash",
				cost: {
					...cheapCost,
					output: OPENROUTER_PRICE_CAP_USD_PER_MILLION.output + 0.01,
				},
			}),
		).toBe(false);
	});

	it("does not interfere with subscription or direct providers", () => {
		expect(isDelegatedModelAllowed({ ...FALLBACK_MODEL, cost: cheapCost })).toBe(true);
		expect(isDelegatedModelAllowed({ provider: "zai", id: "glm-5.3", cost: cheapCost })).toBe(true);
		expect(
			isDelegatedModelAllowed({ provider: "deepseek", id: "deepseek-v4-pro", cost: cheapCost }),
		).toBe(true);
	});
});
