import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const TICK_MS = 1_000;
const ENTRY_TYPE = "o90-turn-time";

interface TurnTimeEntry {
	elapsedMs: number;
}

export function formatElapsedTime(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
	const hours = Math.floor(totalSeconds / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;
	return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function liveTime(pi: ExtensionAPI): void {
	let startedAt: number | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	let activeContext: ExtensionContext | undefined;

	const render = () => {
		if (startedAt === undefined || !activeContext) return;
		activeContext.ui.setWorkingMessage(`Working for ${formatElapsedTime(Date.now() - startedAt)}`);
	};

	const stop = (ctx?: ExtensionContext) => {
		if (timer) clearInterval(timer);
		timer = undefined;
		startedAt = undefined;
		activeContext = undefined;
		ctx?.ui.setWorkingMessage();
	};

	pi.on("agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || startedAt !== undefined) return;
		startedAt = Date.now();
		activeContext = ctx;
		render();
		timer = setInterval(render, TICK_MS);
		timer.unref?.();
	});

	pi.registerEntryRenderer<TurnTimeEntry>(ENTRY_TYPE, (entry, _options, theme) => (
		new Text(theme.fg("dim", `Turn took ${formatElapsedTime(entry.data?.elapsedMs ?? 0)}`), 1, 0)
	));

	pi.on("agent_settled", (_event, ctx) => {
		const elapsedMs = startedAt === undefined ? undefined : Date.now() - startedAt;
		stop(ctx);
		if (ctx.mode === "tui" && elapsedMs !== undefined) {
			pi.appendEntry<TurnTimeEntry>(ENTRY_TYPE, { elapsedMs });
		}
	});

	pi.on("session_shutdown", (_event, ctx) => stop(ctx));
}
