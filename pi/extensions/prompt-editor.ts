import {
	CustomEditor,
	type ExtensionAPI,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		class PromptEditor extends CustomEditor {
			constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
				super(tui, theme, keybindings, { paddingX: 1 });
			}

			render(width: number): string[] {
				const lines = super.render(width);
				if (lines.length < 2) return lines;

				if (width <= 0) return lines;

				const prompt = ctx.ui.theme.fg("accent", "❯ ");
				const firstInputLine = lines[1]?.startsWith(" ") ? lines[1].slice(1) : lines[1];
				lines[1] = prompt + truncateToWidth(firstInputLine ?? "", Math.max(0, width - 2), "");

				return lines;
			}
		}

		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) => new PromptEditor(tui, theme, keybindings),
		);
	});
}
