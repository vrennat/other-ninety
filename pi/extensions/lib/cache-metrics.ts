interface CacheUsage {
	input: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface CacheMetrics {
	latestPercent: number;
	sessionPercent: number;
}

function nonNegative(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function assistantUsage(entry: unknown): CacheUsage | undefined {
	if (!entry || typeof entry !== "object") return undefined;
	const candidate = entry as {
		type?: string;
		message?: { role?: string; usage?: Partial<CacheUsage> };
	};
	if (candidate.type !== "message" || candidate.message?.role !== "assistant") return undefined;
	const usage = candidate.message.usage;
	if (!usage || !nonNegative(usage.input) || !nonNegative(usage.cacheRead) || !nonNegative(usage.cacheWrite)) {
		return undefined;
	}
	return usage as CacheUsage;
}

export function computeCacheMetrics(entries: readonly unknown[]): CacheMetrics | undefined {
	let sessionPrompt = 0;
	let sessionRead = 0;
	let latestPrompt = 0;
	let latestRead = 0;
	let providerReportedCache = false;

	for (const entry of entries) {
		const usage = assistantUsage(entry);
		if (!usage) continue;
		const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
		if (prompt <= 0) continue;
		sessionPrompt += prompt;
		sessionRead += usage.cacheRead;
		latestPrompt = prompt;
		latestRead = usage.cacheRead;
		providerReportedCache ||= usage.cacheRead + usage.cacheWrite > 0;
	}

	if (!providerReportedCache || !latestPrompt || !sessionPrompt) return undefined;
	return {
		latestPercent: (latestRead / latestPrompt) * 100,
		sessionPercent: (sessionRead / sessionPrompt) * 100,
	};
}

export function formatCacheMetrics(metrics: CacheMetrics | undefined): string | undefined {
	if (!metrics) return undefined;
	return `cache ${Math.round(metrics.latestPercent)}/${Math.round(metrics.sessionPercent)}%`;
}
