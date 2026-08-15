import { completeSimple } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";

/**
 * see_image — analyze an image via a vision-capable model when the active
 * session model cannot process images.
 *
 * Why this exists: pi's `read` tool drops image bytes whenever the current
 * model's `input` capability lacks "image" (see dist/core/tools/read.js
 * getNonVisionImageNote). This tool is a side-channel: it forwards the image
 * to a vision model through pi's own provider stack, reusing the configured
 * auth (OAuth subscription or API key), and returns a text description the
 * active model can reason over.
 *
 * The active model stays the cheap orchestrator; the vision model is only
 * invoked on demand, per image.
 */

// Set both variables to any vision-capable model available through Pi.
const VISION_PROVIDER = process.env.OTHER_NINETY_VISION_PROVIDER;
const VISION_MODEL = process.env.OTHER_NINETY_VISION_MODEL;
const MAX_OUTPUT_TOKENS = 1024;
// Soft guard so a huge file doesn't produce a confusing provider error.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TOOL_NAME = "see_image";

const MIME_BY_EXT: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".bmp": "image/bmp",
};

const VISION_SYSTEM_PROMPT = [
	"You are a precise visual analyst for a coding agent.",
	"Describe the image to answer the user's specific question.",
	"Rules:",
	"- Transcribe any visible text, labels, buttons, error messages, and code verbatim.",
	"- Describe layout, colors, and structure only as needed to answer.",
	"- State what you can actually see; never guess or fabricate details.",
	"- Be concise and information-dense. No preamble, no hedging filler.",
].join("\n");

function mimeTypeFor(filePath: string): string | undefined {
	return MIME_BY_EXT[extname(filePath).toLowerCase()];
}

export default function (pi: ExtensionAPI) {
	function syncToolForModel(model: { input?: readonly string[] } | undefined): void {
		const activeTools = pi.getActiveTools();
		const isActive = activeTools.includes(TOOL_NAME);
		const supportsImages = model?.input?.includes("image") ?? false;

		if (supportsImages && isActive) {
			pi.setActiveTools(activeTools.filter((name) => name !== TOOL_NAME));
		} else if (!supportsImages && !isActive) {
			pi.setActiveTools([...activeTools, TOOL_NAME]);
		}
	}

	pi.registerTool({
		name: TOOL_NAME,
		label: "Analyze image",
		description: [
			"Analyze an image file using a vision-capable model and return a text description.",
			"Use this when the current model cannot process images directly — for example, when the `read` tool returned '[Current model does not support images. The image will be omitted from this request.]', or when the user pasted/referenced a screenshot, mockup, diagram, or photo that the active model cannot see.",
			"Always pass the user's specific question or intent in `question` — a focused question yields far better results than a generic 'describe this'.",
			"Supports jpg, png, gif, webp, bmp.",
		].join(" "),
		promptSnippet:
			"see_image: analyze an image via a vision model when the current model can't see images (returns text).",
		promptGuidelines: [
			"When the `read` tool returns an image-omitted notice, or a user references an image/screenshot the current model cannot see, call `see_image` with the user's specific question rather than asking them to describe it.",
		],
		parameters: Type.Object({
			path: Type.String({
				description:
					"Path to the image file. Relative paths resolve against the current working directory.",
			}),
			question: Type.String({
				description:
					"The specific question or detail to extract from the image. Tailor this to what the user actually needs — e.g. 'describe the layout and transcribe the error dialog', 'what color is the accent button', 'read the JSON shown in the panel'.",
			}),
		}),
		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			const requestedPath = String(params.path ?? "").trim();
			const question = String(params.question ?? "").trim();

			if (!requestedPath) {
				return errorResult("`path` is required.");
			}
			if (!question) {
				return errorResult("`question` is required — describe what you want to know about the image.");
			}

			// Resolve relative to the tool's working directory.
			const abs = isAbsolute(requestedPath) ? requestedPath : join(ctx.cwd, requestedPath);

			// Read + validate the image bytes.
			let bytes: Buffer;
			try {
				bytes = await readFile(abs);
			} catch (err) {
				return errorResult(
					`Could not read image at ${abs}: ${(err as NodeJS.ErrnoException).message}`,
				);
			}
			if (bytes.byteLength === 0) {
				return errorResult(`Image file is empty: ${abs}`);
			}
			if (bytes.byteLength > MAX_IMAGE_BYTES) {
				return errorResult(
					`Image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB; limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB. Resize or downscale before retrying.`,
				);
			}

			const mimeType = mimeTypeFor(abs);
			if (!mimeType) {
				return errorResult(
					`Unsupported image extension '${extname(abs)}'. Use png, jpg, jpeg, gif, webp, or bmp.`,
				);
			}

			// Resolve the vision model + its configured auth through pi's registry.
			if (!VISION_PROVIDER || !VISION_MODEL) {
				return errorResult(
					"Set OTHER_NINETY_VISION_PROVIDER and OTHER_NINETY_VISION_MODEL to a vision-capable Pi model.",
				);
			}
			const model = ctx.modelRegistry.find(VISION_PROVIDER, VISION_MODEL);
			if (!model) {
				return errorResult(
					`Vision model '${VISION_PROVIDER}/${VISION_MODEL}' not found in the registry. Check that it is enabled and authed (e.g. via /login).`,
				);
			}
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
			if (!auth.ok) {
				return errorResult(
					`No auth resolved for '${VISION_PROVIDER}/${VISION_MODEL}': ${auth.error}. Run /login or set the provider credential.`,
				);
			}
			if (signal?.aborted) return abortedResult();

			// Run the vision model. completeSimple dispatches to the provider
			// stream, injects auth, and returns the final AssistantMessage.
			let response;
			try {
				response = await completeSimple(
					model,
					{
						systemPrompt: VISION_SYSTEM_PROMPT,
						messages: [
							{
								role: "user",
								content: [
									{ type: "text", text: question },
									{ type: "image", data: bytes.toString("base64"), mimeType },
								],
								timestamp: Date.now(),
							},
						],
					},
					{
						apiKey: auth.apiKey,
						headers: auth.headers,
						maxTokens: MAX_OUTPUT_TOKENS,
						signal,
					},
				);
			} catch (err) {
				return errorResult(
					`Vision request to '${VISION_PROVIDER}/${VISION_MODEL}' failed: ${(err as Error).message}`,
				);
			}

			if (signal?.aborted) return abortedResult();
			if (response.stopReason === "error") {
				return errorResult(
					`Vision model returned an error: ${response.errorMessage ?? "unknown error"}`,
				);
			}

			const description = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("")
				.trim();

			if (!description) {
				return errorResult("Vision model returned no text content.");
			}

			return {
				content: [
					{
						type: "text",
						text: `[see_image via ${VISION_PROVIDER}/${VISION_MODEL}]\n${description}`,
					},
				],
				details: {
					provider: VISION_PROVIDER,
					model: VISION_MODEL,
					imagePath: abs,
					imageBytes: bytes.byteLength,
					usage: response.usage,
				},
			};
		},
	});

	pi.on("session_start", (_event, ctx) => {
		syncToolForModel(ctx.model);
	});

	pi.on("model_select", (event) => {
		syncToolForModel(event.model);
	});
}

function errorResult(message: string) {
	return {
		content: [{ type: "text" as const, text: `[see_image error] ${message}` }],
		details: { error: true, message },
		isError: true,
	};
}

function abortedResult() {
	return {
		content: [{ type: "text" as const, text: "[see_image aborted]" }],
		details: { error: true, aborted: true },
		isError: true,
	};
}
