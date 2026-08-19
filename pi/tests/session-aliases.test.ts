import { describe, expect, test } from "bun:test";
import sessionAliases from "../extensions/session-aliases";

type Command = {
	handler: (args: string, context: unknown) => Promise<void> | void;
};

function harness() {
	const commands = new Map<string, Command>();
	const notifications: string[] = [];
	let newSessionCalls = 0;
	const replacement = {
		hasUI: true,
		ui: { notify: (message: string) => notifications.push(`new:${message}`) },
	};
	const context = {
		ui: { notify: (message: string) => notifications.push(`old:${message}`) },
		newSession: async (options: { withSession?: (ctx: typeof replacement) => Promise<void> }) => {
			newSessionCalls++;
			await options.withSession?.(replacement);
		},
	};
	const pi = { registerCommand: (name: string, command: Command) => commands.set(name, command) };
	sessionAliases(pi as never);
	return {
		get calls() { return newSessionCalls; },
		notifications,
		run: async (args = "") => commands.get("clear")?.handler(args, context),
	};
}

describe("session aliases", () => {
	test("starts a fresh session through the supported lifecycle", async () => {
		const instance = harness();
		await instance.run();
		expect(instance.calls).toBe(1);
		expect(instance.notifications).toEqual(["new:New session started"]);
	});

	test("rejects arguments", async () => {
		const instance = harness();
		await instance.run("unexpected");
		expect(instance.calls).toBe(0);
		expect(instance.notifications).toEqual(["old:Usage: /clear"]);
	});
});
