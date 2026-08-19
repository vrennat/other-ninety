import { describe, expect, test } from "bun:test";
import type { Api, Model } from "@earendil-works/pi-ai";
import { availableEffortLevels } from "../extensions/effort";

function model(overrides: Partial<Model<Api>> = {}): Model<Api> {
	return {
		id: "test-model",
		name: "Test model",
		api: "openai-responses",
		provider: "test-provider",
		baseUrl: "https://example.com",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
		...overrides,
	};
}

describe("effort levels", () => {
	test("returns no levels without a model", () => {
		expect(availableEffortLevels(undefined)).toEqual([]);
	});

	test("uses the levels supported by model metadata", () => {
		expect(availableEffortLevels(model({
			thinkingLevelMap: {
				off: null,
				minimal: null,
				low: "low",
				medium: null,
				high: "high",
				xhigh: null,
				max: "max",
			},
		}))).toEqual(["low", "high", "max"]);
	});
});
