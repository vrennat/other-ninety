import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { relative, resolve, sep } from "node:path";

function formatCount(count: number): string {
	if (count < 1_000) return `${count}`;
	if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
	return `${(count / 1_000_000).toFixed(1)}M`;
}

function formatCwd(cwd: string): string {
	const home = process.env.HOME;
	if (!home) return cwd;

	const relativePath = relative(resolve(home), resolve(cwd));
	const isInsideHome =
		relativePath === "" ||
		(relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
	if (!isInsideHome) return cwd;
	return relativePath ? `~${sep}${relativePath}` : "~";
}

function fitLine(left: string, right: string, width: number): string {
	if (width <= 0) return "";
	if (!right) return truncateToWidth(left, width, "…");

	const gap = 2;
	const rightWidth = Math.min(visibleWidth(right), Math.floor(width * 0.45));
	const fittedRight = truncateToWidth(right, rightWidth, "…");
	const leftWidth = Math.max(0, width - visibleWidth(fittedRight) - gap);
	const fittedLeft = truncateToWidth(left, leftWidth, "…");
	const padding = " ".repeat(
		Math.max(1, width - visibleWidth(fittedLeft) - visibleWidth(fittedRight)),
	);
	return fittedLeft + padding + fittedRight;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsubscribe,
				invalidate(): void {},
				render(width: number): string[] {
					let input = 0;
					let output = 0;
					let cost = 0;
					for (const entry of ctx.sessionManager.getEntries()) {
						if (entry.type !== "message" || entry.message.role !== "assistant") continue;
						const message: AssistantMessage = entry.message;
						input += message.usage.input;
						output += message.usage.output;
						cost += message.usage.cost.total;
					}

					const usage = ctx.getContextUsage();
					const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
					const contextPercent = usage?.percent === null || usage?.percent === undefined
						? "?"
						: `${Math.round(usage.percent)}%`;
					const context = contextWindow
						? `${contextPercent}/${formatCount(contextWindow)}`
						: contextPercent;

					const model = ctx.model?.id ?? "no model";
					const statuses = [...footerData.getExtensionStatuses()]
						.filter(([key]) => !key.startsWith("mcp"))
						.map(([, text]) => text.replace(/[\r\n\t]+/g, " ").trim())
						.filter(Boolean)
						.join(" · ");
					const modelLabel = [model, statuses].filter(Boolean).join(" · ");
					const thinking = pi.getThinkingLevel();
					const modelLine = fitLine(modelLabel, `${thinking} · ${context}`, width);

					const branch = footerData.getGitBranch();
					const sessionName = pi.getSessionName();
					const location = [
						formatCwd(ctx.cwd) + (branch ? ` (${branch})` : ""),
						sessionName,
					].filter(Boolean).join(" · ");
					const stats = [
						input > 0 ? `↑${formatCount(input)}` : undefined,
						output > 0 ? `↓${formatCount(output)}` : undefined,
						cost > 0 ? `$${cost.toFixed(3)}` : undefined,
					].filter(Boolean).join(" ");
					const locationLine = fitLine(location, stats, width);

					return [
						theme.fg("muted", modelLine),
						theme.fg("dim", locationLine),
					];
				},
			};
		});
	});
}
