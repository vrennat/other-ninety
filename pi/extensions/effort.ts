import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getSupportedThinkingLevels, type Api, type Model } from "@earendil-works/pi-ai";
import { ThinkingSelectorComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function availableEffortLevels(model: Model<Api> | undefined): ThinkingLevel[] {
	return model ? getSupportedThinkingLevels(model) as ThinkingLevel[] : [];
}

export default function effort(pi: ExtensionAPI): void {
	pi.registerCommand("effort", {
		description: "Set reasoning effort for the current model",
		handler: async (args, ctx) => {
			if (!ctx.model) {
				ctx.ui.notify("Select a model before setting effort", "warning");
				return;
			}

			const levels = availableEffortLevels(ctx.model);
			const requested = args.trim().toLowerCase();
			if (requested) {
				if (!levels.includes(requested as ThinkingLevel)) {
					ctx.ui.notify(`Effort \"${requested}\" is unavailable. Available: ${levels.join(", ")}`, "warning");
					return;
				}
				pi.setThinkingLevel(requested as ThinkingLevel);
				ctx.ui.notify(`Effort set to ${requested}`, "info");
				return;
			}

			if (ctx.mode !== "tui") {
				ctx.ui.notify(`Available effort levels: ${levels.join(", ")}`, "info");
				return;
			}

			const selected = await ctx.ui.custom<ThinkingLevel | null>((tui, _theme, _keys, done) => {
				const selector = new ThinkingSelectorComponent(pi.getThinkingLevel(), levels, done, () => done(null));
				const list = selector.getSelectList();
				return {
					render: (width: number) => selector.render(width),
					invalidate: () => selector.invalidate(),
					handleInput: (data: string) => {
						list.handleInput(data);
						tui.requestRender();
					},
				};
			});

			if (selected) {
				pi.setThinkingLevel(selected);
				ctx.ui.notify(`Effort set to ${selected}`, "info");
			}
		},
	});
}
