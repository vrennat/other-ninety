import { describe, expect, test } from "bun:test";
import { formatElapsedTime } from "../extensions/live-time";

describe("live time", () => {
	test("formats a zero-padded clock", () => {
		expect(formatElapsedTime(0)).toBe("00:00:00");
		expect(formatElapsedTime(61_000)).toBe("00:01:01");
		expect(formatElapsedTime(3_661_000)).toBe("01:01:01");
	});

	test("clamps negative durations", () => {
		expect(formatElapsedTime(-1_000)).toBe("00:00:00");
	});
});
