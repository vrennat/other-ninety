/**
 * Quota Fallback Extension
 *
 * When a provider returns a usage-quota error (not a transient rate limit),
 * this extension switches to the next available model in an ordered chain.
 * It skips providers whose quota is known to be exhausted and queues a
 * follow-up user message so the task continues instead of stopping.
 *
 * Default chain: zai/glm-5.3 -> openrouter/deepseek/deepseek-v4-pro ->
 *   google/gemini-flash-latest -> openai-codex/gpt-5.6-terra
 *
 * Override by editing this file or importing DEFAULT_FALLBACK_CHAIN and
 * exporting your own from another extension loaded after this one.
 *
 * Pi's built-in retry waits ~14s (2s/4s/8s) on quota 429s before giving up.
 * Set "retry.maxRetries": 1 in ~/.pi/agent/settings.json to cut that to ~2s.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isDelegatedPi, isDelegatedModelAllowed } from "./model-policy";

export interface ChainEntry {
	provider: string;
	id: string;
}

export const DEFAULT_FALLBACK_CHAIN: ChainEntry[] = [
	{ provider: "zai", id: "glm-5.3" },
	{ provider: "openrouter", id: "deepseek/deepseek-v4-pro" },
	{ provider: "google", id: "gemini-flash-latest" },
	{ provider: "openai-codex", id: "gpt-5.6-terra" },
];

const QUOTA_PATTERNS = [/usage_limit_reached/i, /Usage limit reached/i, /"code":"1308"/];

const EXHAUSTED_DEFAULT_MS = 60 * 60 * 1000; // 60 minutes fallback when reset time is unparseable

/**
 * Parse a provider error message to determine if it is a quota exhaustion error
 * and optionally extract the reset timestamp.
 */
export function parseQuotaError(
	errorMessage: string,
): { quota: true; resetAt: Date | undefined } | { quota: false } {
	if (!QUOTA_PATTERNS.some((p) => p.test(errorMessage))) {
		return { quota: false };
	}

	const resetMatch =
		errorMessage.match(/will reset at (\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i) ??
		errorMessage.match(/reset at (\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
	if (!resetMatch) return { quota: true, resetAt: undefined };

	const parts = resetMatch[1].match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
	if (!parts) return { quota: true, resetAt: undefined };

	// Parse as local time (timestamps from providers have no timezone)
	const date = new Date(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6]);
	if (isNaN(date.getTime())) return { quota: true, resetAt: undefined };

	return { quota: true, resetAt: date };
}

type IsAvailableFn = (entry: ChainEntry) => boolean;

/**
 * Pick the next fallback model after the current one in the chain.
 * Wraps to the start if the current model is not found or is the last entry.
 * Skips entries whose provider is exhausted and entries that isAvailable
 * returns false for. Returns undefined when no usable fallback exists.
 */
export function pickFallback(
	chain: ChainEntry[],
	current: { provider: string; id: string } | undefined,
	exhaustedUntil: Record<string, Date | undefined>,
	now: Date,
	isAvailable: IsAvailableFn,
): ChainEntry | undefined {
	if (chain.length === 0) return undefined;

	const currentKey = current ? `${current.provider}/${current.id}` : "";
	const startIndex = current
		? chain.findIndex((e) => `${e.provider}/${e.id}` === currentKey)
		: -1;
	// When current is not in the chain, start from the first entry
	const startPos = startIndex >= 0 ? startIndex : 0;
	const offset = startIndex >= 0 ? 1 : 0;

	for (let i = 0; i < chain.length; i++) {
		const idx = (((startPos + offset + i) % chain.length) + chain.length) % chain.length;
		const entry = chain[idx];

		if (`${entry.provider}/${entry.id}` === currentKey) continue;

		const until = exhaustedUntil[entry.provider];
		if (until !== undefined && until > now) continue;

		if (!isAvailable(entry)) continue;

		return entry;
	}

	return undefined;
}

export default function quotaFallback(pi: ExtensionAPI) {
	const exhaustedUntil: Record<string, Date | undefined> = {};
	let switchCount = 0;

	function markExhausted(provider: string, resetAt: Date | undefined) {
		exhaustedUntil[provider] = resetAt ?? new Date(Date.now() + EXHAUSTED_DEFAULT_MS);
	}

	function isModelAvailable(entry: ChainEntry, ctx: ExtensionContext): boolean {
		const model = ctx.modelRegistry.find(entry.provider, entry.id);
		if (!model) return false;
		if (isDelegatedPi() && !isDelegatedModelAllowed(model)) return false;
		return true;
	}

	async function warnIfExhausted(
		provider: string,
		modelLabel: string,
		ctx: ExtensionContext,
	) {
		const until = exhaustedUntil[provider];
		if (until !== undefined && until > new Date()) {
			ctx.ui.notify(
				`Provider ${modelLabel} is marked exhausted until ${until.toLocaleString()}.`,
				"warning",
			);
		}
	}

	pi.on("agent_end", async (event, ctx) => {
		const messages = (event as { messages?: unknown[] }).messages;
		if (!messages || messages.length === 0) {
			switchCount = 0;
			return;
		}

		// Find the last assistant message
		let lastAssistant: (Record<string, unknown> & { stopReason?: string; errorMessage?: string }) | undefined;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i] as Record<string, unknown>;
			if (msg.role === "assistant") {
				lastAssistant = msg as Record<string, unknown> & { stopReason?: string; errorMessage?: string };
				break;
			}
		}

		if (!lastAssistant) {
			switchCount = 0;
			return;
		}

		// Not an error - successful run, reset switch counter
		if (lastAssistant.stopReason !== "error" || !lastAssistant.errorMessage) {
			switchCount = 0;
			return;
		}

		const parsed = parseQuotaError(lastAssistant.errorMessage);
		if (!parsed.quota) {
			switchCount = 0;
			return;
		}

		const currentProvider = ctx.model?.provider ?? "";
		if (!currentProvider) return;

		markExhausted(currentProvider, parsed.resetAt);

		// Loop guard: at most chain.length switches per run sequence
		if (switchCount >= DEFAULT_FALLBACK_CHAIN.length) {
			ctx.ui.notify(
				`Quota exhausted on ${ctx.model?.provider}/${ctx.model?.id}, but all ${DEFAULT_FALLBACK_CHAIN.length} fallback models have been tried. Stopping.`,
				"error",
			);
			return;
		}

		if (!ctx.model) return;

		const fallback = pickFallback(
			DEFAULT_FALLBACK_CHAIN,
			{ provider: ctx.model.provider, id: ctx.model.id },
			exhaustedUntil,
			new Date(),
			(entry) => isModelAvailable(entry, ctx),
		);

		if (!fallback) {
			ctx.ui.notify(
				`Quota exhausted on ${ctx.model.provider}/${ctx.model.id}; no usable fallback model available.`,
				"error",
			);
			return;
		}

		const fallbackModel = ctx.modelRegistry.find(fallback.provider, fallback.id);
		if (!fallbackModel) return;

		switchCount++;
		const oldLabel = `${ctx.model.provider}/${ctx.model.id}`;
		const newLabel = `${fallback.provider}/${fallback.id}`;
		const resetMsg = parsed.resetAt
			? ` (resets at ${parsed.resetAt.toLocaleString()})`
			: "";

		ctx.ui.notify(
			`Quota exhausted on ${oldLabel}; switched to ${newLabel}${resetMsg}`,
			"warning",
		);

		const changed = await pi.setModel(fallbackModel);
		if (!changed) {
			ctx.ui.notify(`No credential for fallback model ${newLabel}.`, "error");
			return;
		}

		await pi.sendUserMessage(
			`Provider quota exhausted on ${oldLabel}; switched to ${newLabel}. Continue the previous task from where it stopped.`,
		);
	});

	pi.on("model_select", async (event, ctx) => {
		const model = (event as { model?: { provider: string; id: string } }).model;
		if (!model) return;
		await warnIfExhausted(model.provider, `${model.provider}/${model.id}`, ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!ctx.model) return;
		await warnIfExhausted(ctx.model.provider, `${ctx.model.provider}/${ctx.model.id}`, ctx);
	});
}