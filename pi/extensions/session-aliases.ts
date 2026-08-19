import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function sessionAliases(pi: ExtensionAPI): void {
	pi.registerCommand("clear", {
		description: "Start a new session (alias for /new)",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("Usage: /clear", "warning");
				return;
			}

			await ctx.newSession({
				withSession: async (newContext) => {
					if (newContext.hasUI) newContext.ui.notify("New session started", "info");
				},
			});
		},
	});
}
