/**
 * Fun Verbs Extension
 *
 * Replaces pi's default "Working..." spinner text with a rotating cast of
 * verbs (a la Claude Code) while a model is running. Picks a random verb at
 * the start of each agent run and rotates to a new one every few seconds,
 * then restores the default message when the agent settles.
 *
 * Visual only; in non-TUI modes it does nothing.
 *
 * Reload after editing: /reload
 * Disable: remove this file and /reload (or set FUN_VERBS_OFF=1).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Present-progressive with ellipsis to match pi's default "Working..." style.
const VERBS: readonly string[] = [
	"Pondering...",
	"Cogitating...",
	"Mulling it over...",
	"Crunching...",
	"Brewing...",
	"Considering...",
	"Turning it over...",
	"Chewing on it...",
	"Thinking...",
	"Connecting dots...",
	"Searching for an angle...",
	"Warming up...",
	"Spinning up...",
	"Running the numbers...",
	"Consulting the docs...",
	"Grepping my memory...",
	"Paging in context...",
	"Resolving symbols...",
	"Marshaling tokens...",
	"Tracing the stack...",
	"Loading brain.dll...",
	"Indexing neurons...",
	"Compiling thoughts...",
	"Weighing options...",
	"Untangling the yarn...",
	"Reading the room...",
	"Doing the math...",
	"Knitting an answer...",
];

const ROTATE_MS = 4000;

let rotateTimer: ReturnType<typeof setInterval> | undefined;
let lastIndex = -1;

function randomVerb(): string {
	if (VERBS.length <= 1) return VERBS[0];
	let i = lastIndex;
	while (i === lastIndex) i = Math.floor(Math.random() * VERBS.length);
	lastIndex = i;
	return VERBS[i];
}

function stopRotation() {
	if (rotateTimer !== undefined) {
		clearInterval(rotateTimer);
		rotateTimer = undefined;
	}
}

function startRotation(ctx: ExtensionContext) {
	stopRotation();
	ctx.ui.setWorkingMessage(randomVerb());
	rotateTimer = setInterval(() => {
		ctx.ui.setWorkingMessage(randomVerb());
	}, ROTATE_MS);
}

export default function (pi: ExtensionAPI) {
	if (process.env.FUN_VERBS_OFF) return;

	pi.on("agent_start", async (_event, ctx) => {
		// Only the TUI shows the spinner; skip in rpc/print/json modes.
		if (ctx.mode !== "tui") return;
		startRotation(ctx);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		stopRotation();
		// Restore pi's default "Working..." for any later indicator.
		ctx.ui.setWorkingMessage(undefined);
	});

	// Cleanup if the session is torn down mid-run.
	pi.on("session_shutdown", async () => {
		stopRotation();
	});
}
