import type { ContentBlock } from "./mcp-client.ts";

const MAX_TEXT_BYTES = 50 * 1024;
const MAX_TEXT_LINES = 2_000;

export type BrowserToolContent =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

const DESCRIPTION_HINTS: Record<string, string> = {
	click: " Use a uid from take_snapshot. Take a fresh snapshot after state-changing actions.",
	fill: " Use a uid from take_snapshot. For custom widgets, click first and use type_text.",
	navigate_page: " Call take_snapshot after navigation to inspect the page.",
	new_page: " Call take_snapshot after opening the page.",
	press_key: " Pass one key name such as Enter or Escape; use type_text for strings.",
	take_snapshot: " Use this before interaction to obtain current element uids.",
};

export function buildToolDescription(name: string, description?: string): string {
	return `${description ?? `Control Chrome with ${name}.`}${DESCRIPTION_HINTS[name] ?? ""}`;
}

function truncateUtf8(text: string, maxBytes: number): string {
	const bytes = Buffer.from(text, "utf8");
	if (bytes.length <= maxBytes) return text;

	let end = maxBytes;
	while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
	return bytes.subarray(0, end).toString("utf8");
}

export function postProcessText(name: string, text: string): string {
	let processed = text;
	if (name !== "take_snapshot" && processed.includes("## Latest page snapshot")) {
		processed = processed.split("## Latest page snapshot", 1)[0]?.trim() ?? "";
	}

	const truncationReasons: string[] = [];
	const lines = processed.split("\n");
	if (lines.length > MAX_TEXT_LINES) {
		processed = lines.slice(0, MAX_TEXT_LINES).join("\n");
		truncationReasons.push(`${MAX_TEXT_LINES} lines`);
	}
	if (Buffer.byteLength(processed, "utf8") > MAX_TEXT_BYTES) {
		processed = truncateUtf8(processed, MAX_TEXT_BYTES - 200);
		truncationReasons.push("50KB");
	}
	if (truncationReasons.length > 0) {
		processed += `\n\n[Browser output truncated at ${truncationReasons.join(" and ")}. Use filters or pagination for a smaller result.]`;
	}
	return processed;
}

export function convertMcpContent(name: string, blocks: ContentBlock[]): BrowserToolContent[] {
	const content: BrowserToolContent[] = [];
	for (const block of blocks) {
		switch (block.type) {
			case "text":
				content.push({ type: "text", text: postProcessText(name, block.text) });
				break;
			case "image":
				content.push({ type: "image", data: block.data, mimeType: block.mimeType });
				break;
			case "resource":
				if ("text" in block.resource) {
					content.push({ type: "text", text: postProcessText(name, block.resource.text) });
				} else if (block.resource.mimeType?.startsWith("image/")) {
					content.push({
						type: "image",
						data: block.resource.blob,
						mimeType: block.resource.mimeType,
					});
				} else {
					content.push({
						type: "text",
						text: `[Binary resource: ${block.resource.mimeType ?? "unknown type"}, ${block.resource.blob.length} base64 characters]`,
					});
				}
				break;
		}
	}
	return content.length > 0 ? content : [{ type: "text", text: "Browser tool completed with no output." }];
}

export function getErrorMessage(name: string, content: BrowserToolContent[]): string {
	const message = content
		.filter((block): block is { type: "text"; text: string } => block.type === "text")
		.map((block) => block.text)
		.filter(Boolean)
		.join("\n");
	return message || `Browser tool ${name} failed.`;
}
