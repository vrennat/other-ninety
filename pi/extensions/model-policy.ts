import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type PiModel = Parameters<ExtensionAPI["setModel"]>[0];

export const CHEAP_OPENROUTER_MODELS = new Set([
	"deepseek/deepseek-v4-flash",
	"openai/gpt-oss-120b",
	"openai/gpt-oss-20b",
	"poolside/laguna-s-2.1",
	"poolside/laguna-xs-2.1",
	"qwen/qwen3-coder-30b-a3b-instruct",
	"qwen/qwen3.7-flash",
]);

export const OPENROUTER_PRICE_CAP_USD_PER_MILLION = {
	input: 0.15,
	output: 0.3,
} as const;

export const DELEGATED_PI_ENV = "OTHER_NINETY_PI_LEAF";

export const FALLBACK_MODEL = {
	provider: "openai-codex",
	id: "gpt-5.6-terra",
} as const;

export function isDelegatedPi(env: Record<string, string | undefined> = process.env): boolean {
	return env[DELEGATED_PI_ENV] === "1";
}

export function isDelegatedModelAllowed(model: Pick<PiModel, "provider" | "id" | "cost">): boolean {
	if (model.provider !== "openrouter") return true;
	return (
		CHEAP_OPENROUTER_MODELS.has(model.id) &&
		model.cost.input <= OPENROUTER_PRICE_CAP_USD_PER_MILLION.input &&
		model.cost.output <= OPENROUTER_PRICE_CAP_USD_PER_MILLION.output
	);
}

export default function modelPolicy(pi: ExtensionAPI) {
	// Direct Pi sessions remain unrestricted. Cross-harness launchers set this
	// marker and explicitly load the policy extension for their worker process.
	if (!isDelegatedPi()) return;

	let redirecting = false;

	async function enforce(model: PiModel, ctx: ExtensionContext) {
		if (isDelegatedModelAllowed(model) || redirecting) return;

		const rejected = `${model.provider}/${model.id}`;
		const fallback = ctx.modelRegistry.find(FALLBACK_MODEL.provider, FALLBACK_MODEL.id);
		if (!fallback) {
			ctx.ui.notify(
				`Blocked disallowed model ${rejected}; ${FALLBACK_MODEL.provider}/${FALLBACK_MODEL.id} is unavailable`,
				"error",
			);
			ctx.abort();
			return;
		}

		redirecting = true;
		try {
			const changed = await pi.setModel(fallback);
			if (!changed) {
				ctx.ui.notify(
					`Blocked disallowed model ${rejected}; fallback has no usable credential`,
					"error",
				);
				ctx.abort();
				return;
			}
			ctx.ui.notify(
				`Blocked disallowed model ${rejected}; switched to ${FALLBACK_MODEL.provider}/${FALLBACK_MODEL.id}`,
				"warning",
			);
		} finally {
			redirecting = false;
		}
	}

	pi.on("model_select", async (event, ctx) => {
		await enforce(event.model, ctx);
	});

	// Covers restored and command-line model selections before any provider call.
	pi.on("before_agent_start", async (_event, ctx) => {
		if (ctx.model) await enforce(ctx.model, ctx);
	});
}
