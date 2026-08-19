import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";
export const MCP_HEALTH_STATUS_KEY = "mcp-health";

const HEALTHY_STATES = new Set(["connected", "cached", "not-connected", "disabled"]);

interface ServerStatus {
	name: string;
	status: string;
	failedAgoSeconds?: number;
	disabled?: boolean;
}

function isServerStatus(value: unknown): value is ServerStatus {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return typeof record.name === "string" && record.name.length > 0 && typeof record.status === "string";
}

export function describeMcpProblem(server: ServerStatus): string {
	if (server.status === "needs-auth") return `${server.name} needs auth`;
	if (server.status !== "failed") return `${server.name} ${server.status}`;
	const age = server.failedAgoSeconds;
	return typeof age === "number" && Number.isFinite(age) && age >= 0
		? `${server.name} failed ${Math.round(age)}s ago`
		: `${server.name} failed`;
}

export function formatMcpHealth(snapshot: unknown): string | undefined {
	if (!snapshot || typeof snapshot !== "object") return undefined;
	const servers = (snapshot as { servers?: unknown }).servers;
	if (!Array.isArray(servers)) return undefined;

	const problems = servers
		.filter(isServerStatus)
		.filter((server) => server.disabled !== true && !HEALTHY_STATES.has(server.status))
		.map(describeMcpProblem);
	return problems.length ? `MCP: ${problems.join(", ")}` : undefined;
}

export default function mcpHealth(pi: ExtensionAPI): void {
	let latestSnapshot: unknown;
	let context: ExtensionContext | undefined;

	const render = () => {
		if (!context || context.mode !== "tui") return;
		const health = formatMcpHealth(latestSnapshot);
		context.ui.setStatus(
			MCP_HEALTH_STATUS_KEY,
			health ? (context.ui.theme?.fg("warning", health) ?? health) : undefined,
		);
	};

	pi.events.on(MCP_STATUS_EVENT, (snapshot: unknown) => {
		latestSnapshot = snapshot;
		render();
	});

	pi.on("session_start", (_event, ctx) => {
		context = ctx;
		render();
	});
}
