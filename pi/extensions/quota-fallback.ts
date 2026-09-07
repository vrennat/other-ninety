import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isDelegatedModelAllowed, isDelegatedPi } from "./model-policy.ts";

// Switches model when a provider says its usage quota is exhausted.
//
// Pi's own retry (settings `retry.maxRetries`, default 3, backoff 2s/4s/8s) treats a quota
// 429 like a transient rate limit, gives up with "Retry failed after 3 attempts", and stops.
// A 5-hour window cannot be retried through, so this extension listens for the failed run,
// marks the provider exhausted until the reset time the provider reported, moves to the next
// model in DEFAULT_FALLBACK_CHAIN that has a credential (and passes the delegated-worker
// policy when OTHER_NINETY_PI_LEAF=1), and queues a user message so the task continues.
// Change the order by editing DEFAULT_FALLBACK_CHAIN; the chain wraps, so the current model
// need not be in it. Lowering `retry.maxRetries` to 1 in ~/.pi/agent/settings.json cuts the
// wasted wait before this fires from 14s to 2s; this file does not touch settings.

type PiModel = Parameters<ExtensionAPI["setModel"]>[0];

export interface ChainEntry {
	provider: string;
	id: string;
}

export const DEFAULT_FALLBACK_CHAIN: readonly ChainEntry[] = [
	{ provider: "zai", id: "glm-5.3" },
	{ provider: "openrouter", id: "deepseek/deepseek-v4-pro" },
	{ provider: "google", id: "gemini-flash-latest" },
	{ provider: "openai-codex", id: "gpt-5.6-terra" },
];

// Used when the provider gives no reset time, or one that has already passed.
export const DEFAULT_EXHAUSTED_MS = 60 * 60 * 1000;

const QUOTA_PATTERNS: readonly RegExp[] = [
	/"code"\s*:\s*"1308"/,
	/usage[ _]limit[ _]reached/i,
	/usage limit has been reached/i,
];

// Z.ai reports "Your limit will reset at 2026-09-08 09:29:08" with no zone; it is local time.
const RESET_AT = /reset at (\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/;

export type QuotaVerdict = { quota: true; resetAt: Date | undefined } | { quota: false };

export function parseQuotaError(errorMessage: string | undefined): QuotaVerdict {
	if (!errorMessage) return { quota: false };
	if (!QUOTA_PATTERNS.some((p) => p.test(errorMessage))) return { quota: false };
	const m = errorMessage.match(RESET_AT);
	if (!m) return { quota: true, resetAt: undefined };
	const resetAt = new Date(`${m[1]}T${m[2]}`);
	return { quota: true, resetAt: Number.isNaN(resetAt.getTime()) ? undefined : resetAt };
}

export function exhaustedUntil(verdict: QuotaVerdict, now: Date): Date {
	const fallback = new Date(now.getTime() + DEFAULT_EXHAUSTED_MS);
	if (!verdict.quota || !verdict.resetAt || verdict.resetAt.getTime() <= now.getTime()) return fallback;
	return verdict.resetAt;
}

export function isExhausted(exhausted: ReadonlyMap<string, Date>, provider: string, now: Date): boolean {
	const until = exhausted.get(provider);
	return until !== undefined && until.getTime() > now.getTime();
}

// Every chain entry worth trying, in order: after the current model (wrapping), never the
// current model itself, never a provider still inside its exhausted window.
export function orderFallbacks(
	chain: readonly ChainEntry[],
	current: ChainEntry | undefined,
	exhausted: ReadonlyMap<string, Date>,
	now: Date,
): ChainEntry[] {
	const n = chain.length;
	if (n === 0) return [];
	const idx = current ? chain.findIndex((e) => e.provider === current.provider && e.id === current.id) : -1;
	const steps = idx === -1 ? n : n - 1;
	const out: ChainEntry[] = [];
	for (let k = 1; k <= steps; k++) {
		const entry = chain[(idx + k) % n];
		if (!entry || isExhausted(exhausted, entry.provider, now)) continue;
		if (current && entry.provider === current.provider && entry.id === current.id) continue;
		out.push(entry);
	}
	return out;
}

export function pickFallback(
	chain: readonly ChainEntry[],
	current: ChainEntry | undefined,
	exhausted: ReadonlyMap<string, Date>,
	now: Date,
	isAvailable: (entry: ChainEntry) => boolean,
): ChainEntry | undefined {
	return orderFallbacks(chain, current, exhausted, now).find(isAvailable);
}

// Leaf workers must stay inside the cheap-model policy even while falling back.
export function isAllowedForSession(
	model: Pick<PiModel, "provider" | "id" | "cost">,
	delegated: boolean = isDelegatedPi(),
): boolean {
	return !delegated || isDelegatedModelAllowed(model);
}

interface AssistantLike {
	role: "assistant";
	stopReason?: string;
	errorMessage?: string;
	provider?: string;
	model?: string;
}

// The failed run's last assistant message, when it is a quota failure.
export function findQuotaFailure(
	messages: ReadonlyArray<{ role: string }>,
): { message: AssistantLike; verdict: { quota: true; resetAt: Date | undefined } } | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (!m || m.role !== "assistant") continue;
		const message = m as AssistantLike;
		if (message.stopReason !== "error") return undefined;
		const verdict = parseQuotaError(message.errorMessage);
		return verdict.quota ? { message, verdict } : undefined;
	}
	return undefined;
}

function label(m: { provider?: string; id?: string; model?: string } | undefined): string {
	if (!m) return "unknown model";
	return `${m.provider ?? "?"}/${m.id ?? m.model ?? "?"}`;
}

export default function quotaFallback(pi: ExtensionAPI, chain: readonly ChainEntry[] = DEFAULT_FALLBACK_CHAIN) {
	const exhausted = new Map<string, Date>();
	let switches = 0;

	function warnIfExhausted(model: PiModel | undefined, ctx: ExtensionContext) {
		if (!model) return;
		const until = exhausted.get(model.provider);
		if (until && until.getTime() > Date.now()) {
			ctx.ui.notify(`${label(model)}: quota was exhausted; expected to reset ${until.toLocaleString()}`, "warning");
		}
	}

	pi.on("agent_end", async (event, ctx) => {
		const failure = findQuotaFailure(event.messages);
		if (!failure) {
			switches = 0;
			return;
		}
		const now = new Date();
		const oldModel = ctx.model;
		const oldLabel = failure.message.provider
			? `${failure.message.provider}/${failure.message.model ?? oldModel?.id ?? "?"}`
			: label(oldModel);
		const exhaustedProvider = failure.message.provider ?? oldModel?.provider;
		const until = exhaustedUntil(failure.verdict, now);
		if (exhaustedProvider) exhausted.set(exhaustedProvider, until);

		if (switches >= chain.length) {
			ctx.ui.notify(`Quota exhausted on ${oldLabel}; already switched ${switches} times this run, stopping`, "error");
			return;
		}
		const current = oldModel ? { provider: oldModel.provider, id: oldModel.id } : undefined;
		const delegated = isDelegatedPi();
		for (const entry of orderFallbacks(chain, current, exhausted, now)) {
			const candidate = ctx.modelRegistry.find(entry.provider, entry.id);
			if (!candidate || !isAllowedForSession(candidate, delegated)) continue;
			if (!(await pi.setModel(candidate))) continue;
			switches++;
			const newLabel = label(candidate);
			ctx.ui.notify(
				`Quota exhausted on ${oldLabel} until ${until.toLocaleString()}; switched to ${newLabel}`,
				"warning",
			);
			pi.sendUserMessage(
				`Provider quota exhausted on ${oldLabel}; switched to ${newLabel}. Continue the previous task from where it stopped.`,
			);
			return;
		}
		ctx.ui.notify(`Quota exhausted on ${oldLabel} until ${until.toLocaleString()}; no fallback model available`, "error");
	});

	pi.on("model_select", async (event, ctx) => {
		warnIfExhausted(event.model, ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		warnIfExhausted(ctx.model, ctx);
	});
}
