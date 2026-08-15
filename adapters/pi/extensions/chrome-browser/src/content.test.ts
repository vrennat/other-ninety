import { describe, expect, test } from "bun:test";
import { buildToolDescription, convertMcpContent, getErrorMessage, postProcessText } from "./content.ts";

describe("browser tool content", () => {
	test("preserves MCP text and image content", () => {
		const content = convertMcpContent("take_screenshot", [
			{ type: "text", text: "captured" },
			{ type: "image", data: "base64", mimeType: "image/jpeg" },
		]);
		expect(content).toEqual([
			{ type: "text", text: "captured" },
			{ type: "image", data: "base64", mimeType: "image/jpeg" },
		]);
	});

	test("removes embedded snapshots from action results", () => {
		const text = postProcessText("click", "Clicked\n\n## Latest page snapshot\nlarge tree");
		expect(text).toBe("Clicked");
	});

	test("retains explicit snapshot output", () => {
		const text = "## Latest page snapshot\nbutton uid=1";
		expect(postProcessText("take_snapshot", text)).toBe(text);
	});

	test("returns useful output when MCP content is empty", () => {
		expect(convertMcpContent("click", [])).toEqual([
			{ type: "text", text: "Browser tool completed with no output." },
		]);
	});

	test("builds interaction guidance into descriptions", () => {
		expect(buildToolDescription("take_snapshot", "Snapshot the page.")).toContain("before interaction");
	});

	test("extracts a model-facing error message", () => {
		expect(getErrorMessage("click", [{ type: "text", text: "Element was stale" }])).toBe("Element was stale");
	});

	test("truncates oversized text without splitting UTF-8 characters", () => {
		const text = postProcessText("take_snapshot", `prefix${"€".repeat(30 * 1024)}`);
		expect(text).toContain("[Browser output truncated at 50KB.");
		expect(text).not.toContain("�");
	});

	test("describes non-image binary resources instead of dropping them", () => {
		const content = convertMcpContent("evaluate_script", [{
			type: "resource",
			resource: { uri: "file:///tmp/result.pdf", blob: "YWJj", mimeType: "application/pdf" },
		}]);
		expect(content).toEqual([{ type: "text", text: "[Binary resource: application/pdf, 4 base64 characters]" }]);
	});
});
