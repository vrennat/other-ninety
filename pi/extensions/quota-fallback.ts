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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainEntry {
	provider: string;
	id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_FALLBACK_CHAIN: ChainEntry[] = [
	{ provider: "zai", id: "glm-5.3" },
	{ provider: "openrouter", id: "deepseek/deepseek-v4-pro" },
	{ provider: "google", id: "gemini-flash-latest" },
	{ provider: "openai-codex", id: "gpt-5.6-terra" },
];

/**
 * Fallback exhaustion window (60 minutes) used when the provider error
 * does not include a parseable reset timestamp.
 */
export const DEFAULT_EXHAUSTED_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Quota helpers
// ---------------------------------------------------------------------------

/**
 * Regexp matching quota-exhaustion signals in provider error messages.
 * Covers the known Z.ai body, `usage_limit_reached`, and all case-variants
 * of "Usage limit reached" (which also catches "Monthly usage limit reached"
 * that Pi's own `isRetryableAssistantError` treats as non-retryable).
 */
const QUOTA_RE = /(?:usage_limit_reached|usage\s+limit\s+reached)/i;

/**
 * Extract the "will reset at <datetime>" or "reset at <datetime>" portion
 * of the error body. The reset timestamp has no timezone and should be
 * parsed as local time.
 */
const RESET_RE = /will reset at (\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i;

/**
 * Parse a provider error message to determine if it is a quota exhaustion
 * error and optionally extract the reset timestamp.
 *
 * Returns `{ quota: true, resetAt: Date | undefined }` on quota match.
 * Returns `{ quota: false }` for non-quota errors.
 */
export function parseQuotaError(
	errorMessage: string | undefined,
): { quota: true; resetAt: Date | undefined } | { quota: false } {
	if (!errorMessage) return { quota: false };
	if (!QUOTA_RE.test(errorMessage)) return { quota: false };

	const m = errorMessage.match(RESET_RE);
	if (!m) return { quota: true, resetAt: undefined };

	const parts = m[1].match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
	if (!parts) return { quota: true, resetAt: undefined };

	// Parse as local time (providers send timestamps without a timezone).
	const date = new Date(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6]);
	if (isNaN(date.getTime())) return { quota: true, resetAt: undefined };

	return { quota: true, resetAt: date };
}

// ---------------------------------------------------------------------------
// Exhaustion window
// ---------------------------------------------------------------------------

/**
 * Compute the actual exhaustion deadline. Uses the provider-reported resetAt
 * when it is in the future; otherwise falls back to `now + DEFAULT_EXHAUSTED_MS`.
 */
export function exhaustedUntil(
	quotaResult: { quota: true; resetAt: Date | undefined },
	now: Date,
): Date {
	if (quotaResult.resetAt && quotaResult.resetAt > now) return quotaResult.resetAt;
	return new Date(now.getTime() + DEFAULT_EXHAUSTED_MS);
}

// ---------------------------------------------------------------------------
// Fallback helpers
// ---------------------------------------------------------------------------

export type IsAvailableFn = (entry: ChainEntry) => boolean;

/**
 * Return the chain ordered from the entry after `current`, wrapping around.
 * Skips entries whose provider is exhausted (still inside its window).
 * Returns the full ordered list (including exhausted entries? No - exhausted
 * ones are skipped).
 *
 * Actually, to keep the pick/order distinction clean:
 * - `orderFallbacks` returns every chain entry in fallback order, regardless
 *   of availability. It DOES skip exhausted entries.
 * - `pickFallback` uses `isAvailable` to further filter.
 */
export function orderFallbacks(
	chain: ChainEntry[],
	current: { provider: string; id: string } | undefined,
	exhaustedWindow: Record<string, Date | undefined>,
	now: Date,
): ChainEntry[] {
	if (chain.length === 0) return [];
	const curKey = current ? `${current.provider}/${current.id}` : "";
	const curIdx = current
		? chain.findIndex((e) => `${e.provider}/${e.id}` === curKey)
		: -1;

	const result: ChainEntry[] = [];
	for (let i = 0; i < chain.length; i++) {
		const idx = curIdx >= 0 ? (curIdx + 1 + i) % chain.length : i;
		const entry = chain[idx];

		if (`${entry.provider}/${entry.id}` === curKey) continue;

		const until = exhaustedWindow[entry.provider];
		if (until !== undefined && until > now) continue;

		result.push(entry);
	}
	return result;
}

/**
 * Pick the first usable fallback model.
 *
 * Returns the first entry from `orderFallbacks` for which `isAvailable`
 * returns true, or `undefined` when nothing is usable.
 */
export function pickFallback(
	chain: ChainEntry[],
	current: { provider: string; id: string } | undefined,
	exhaustedWindow: Record<string, Date | undefined>,
	now: Date,
	isAvailable: IsAvailableFn,
): ChainEntry | undefined {
	return orderFallbacks(chain, current, exhaustedWindow, now).find(isAvailable);
}

// ---------------------------------------------------------------------------
// Message inspection
// ---------------------------------------------------------------------------

/**
 * Find the last assistant message that ended with a quota error in an
 * agent-end event's message list.
 */
export function findQuotaFailure(
	messages: ReadonlyArray<Record<string, unknown>>,
): { message: Record<string, unknown>; verdict: { quota: true; resetAt: Date | undefined } } | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;
		if (msg.stopReason !== "error") continue;
		const err = msg.errorMessage;
		if (typeof err !== "string") continue;
		const verdict = parseQuotaError(err);
		if (!verdict.quota) continue;
		return { message: msg, verdict };
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Delegation policy
// ---------------------------------------------------------------------------

/**
 * Check whether `model` is allowed for the current session type.
 *
 * Direct sessions (isDelegated = false) always return true.
 * Delegated sessions restrict OpenRouter models to the cheap allowlist.
 */
export function isAllowedForSession(
	model: { provider: string; id: string; cost?: { input: number; output: number } },
	delegated: boolean,
): boolean {
	if (!delegated) return true;
	// Outside model-policy.ts we delegate to the same check.
	return isDelegatedModelAllowed(model as Parameters<typeof isDelegatedModelAllowed>[0]);
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

export default function quotaFallback(pi: ExtensionAPI) {
	const chain = [...DEFAULT_FALLBACK_CHAIN];
	const exhaustedWindow: Record<string, Date | undefined> = {};
	let switchCount = 0;

	function markExhausted(provider: string, resetAt: Date | undefined, now: Date) {
		exhaustedWindow[provider] = resetAt && resetAt > now ? resetAt : new Date(now.getTime() + DEFAULT_EXHAUSTED_MS);
	}

	function modelIsAvailable(entry: ChainEntry, ctx: ExtensionContext): boolean {
		const model = ctx.modelRegistry.find(entry.provider, entry.id);
		if (!model) return false;
		if (isDelegatedPi() && !isDelegatedModelAllowed(model)) return false;
		return true;
	}

	async function warnExhaustedProvider(label: string, provider: string, ctx: ExtensionContext) {
		const until = exhaustedWindow[provider];
		if (until && until > new Date()) {
			ctx.ui.notify(
				`Provider ${label} is marked exhausted until ${until.toLocaleString()}.`,
				"warning",
			);
		}
	}

	// -- agent_end -----------------------------------------------------------

	pi.on("agent_end", async (event, ctx) => {
		const messages = (event as { messages?: unknown[] }).messages;
		if (!messages || messages.length === 0) {
			switchCount = 0;
			return;
		}

		const failure = findQuotaFailure(messages as Array<Record<string, unknown>>);

		// Run ended without quota failure - reset the loop counter.
		if (!failure) {
			switchCount = 0;
			return;
		}

		const now = new Date();
		const currentModel = ctx.model;
		if (!currentModel) return;

		markExhausted(currentModel.provider, failure.verdict.resetAt, now);

		// Guard: too many fallback switches in this run sequence.
		if (switchCount >= chain.length) {
			ctx.ui.notify(
				`Quota exhausted on ${currentModel.provider}/${currentModel.id}; all ${chain.length} fallback models have been tried. Stopping.`,
				"error",
			);
			return;
		}

		const fallback = pickFallback(
			chain,
			{ provider: currentModel.provider, id: currentModel.id },
			exhaustedWindow,
			now,
			(entry) => modelIsAvailable(entry, ctx),
		);

		if (!fallback) {
			ctx.ui.notify(
				`Quota exhausted on ${currentModel.provider}/${currentModel.id}; no usable fallback model available.`,
				"error",
			);
			return;
		}

		const fbModel = ctx.modelRegistry.find(fallback.provider, fallback.id);
		if (!fbModel) return;

		const oldLabel = `${currentModel.provider}/${currentModel.id}`;
		const newLabel = `${fallback.provider}/${fallback.id}`;

		const changed = await pi.setModel(fbModel);
		if (!changed) {
			ctx.ui.notify(`Quota exhausted; no credential for fallback ${newLabel}.`, "error");
			return;
		}

		switchCount++;

		const resetMsg = failure.verdict.resetAt
			? ` (resets at ${failure.verdict.resetAt.toLocaleString()})`
			: "";

		ctx.ui.notify(
			`Quota exhausted on ${oldLabel}; switched to ${newLabel}${resetMsg}`,
			"warning",
		);

		await pi.sendUserMessage(
			`Provider quota exhausted on ${oldLabel}; switched to ${newLabel}. Continue the previous task from where it stopped.`,
		);
	});

	// -- model_select / before_agent_start (warning-only) --------------------

	pi.on("model_select", async (event, ctx) => {
		const m = (event as { model?: { provider: string; id: string } }).model;
		if (!m) return;
		await warnExhaustedProvider(`${m.provider}/${m.id}`, m.provider, ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!ctx.model) return;
		await warnExhaustedProvider(
			`${ctx.model.provider}/${ctx.model.id}`,
			ctx.model.provider,
			ctx,
		);
	});
}