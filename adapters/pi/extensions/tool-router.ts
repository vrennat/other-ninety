import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const CAPABILITY_TOOLS = {
	web: ["web_search", "fetch_content", "get_search_content"],
	workflows: ["workflow", "workflow_control"],
	hypa: ["hypa_shell", "hypa_read", "hypa_grep", "hypa_find", "hypa_ls", "hypa_mcp_proxy"],
} as const;

type Capability = keyof typeof CAPABILITY_TOOLS;

const CAPABILITIES = Object.keys(CAPABILITY_TOOLS) as Capability[];
const DEFERRED_TOOLS = new Set<string>(Object.values(CAPABILITY_TOOLS).flat());

export default function toolRouter(pi: ExtensionAPI): void {
	let hasInitialized = false;

	pi.registerTool({
		name: "load_capability",
		label: "Load capability",
		description: "Load optional tools on demand: web research, explicit multi-agent workflows, or Hypa-compressed file and shell operations.",
		promptSnippet: "Load optional web, workflow, or Hypa tools when needed",
		promptGuidelines: [
			"Use load_capability before web research, an explicitly requested workflow, or Hypa-compressed operations when those tools are not active.",
		],
		parameters: Type.Object({
			capability: StringEnum(CAPABILITIES, {
				description: "Optional tool group to load for the current session",
			}),
		}),
		async execute(_toolCallId, params) {
			const capability = params.capability as Capability;
			const registeredNames = new Set(pi.getAllTools().map((tool) => tool.name));
			const names = CAPABILITY_TOOLS[capability].filter((name) => registeredNames.has(name));
			const activeNames = pi.getActiveTools();
			const added = names.filter((name) => !activeNames.includes(name));

			pi.setActiveTools([...new Set([...activeNames, ...added])]);

			return {
				content: [{
					type: "text",
					text: added.length > 0
						? `Loaded ${capability} tools: ${added.join(", ")}`
						: `${capability} tools are already active or unavailable.`,
				}],
				details: { capability, added },
			};
		},
	});

	pi.on("resources_discover", () => {
		if (hasInitialized) return;
		hasInitialized = true;

		const activeNames = pi.getActiveTools().filter((name) => !DEFERRED_TOOLS.has(name));
		pi.setActiveTools(activeNames);
	});
}
