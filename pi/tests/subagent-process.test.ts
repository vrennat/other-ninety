import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSingleAgent } from "../extensions/subagent/index";

const originalScript = process.argv[1];
const directories: string[] = [];
afterEach(() => {
	process.argv[1] = originalScript;
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const assistant = (text = "done", stopReason = "stop", errorMessage?: string) => ({
	role: "assistant", content: [{ type: "text", text }], stopReason, errorMessage,
});
async function run(source: string, signal?: AbortSignal) {
	const directory = mkdtempSync(join(tmpdir(), "subagent-test-"));
	directories.push(directory);
	const script = join(directory, "fake.js");
	writeFileSync(script, source);
	process.argv[1] = script;
	return runSingleAgent(directory, [{ name: "test", description: "test", systemPrompt: "", source: "user", filePath: "" }],
		"test", "test", undefined, undefined, signal, undefined,
		(results) => ({ mode: "single", agentScope: "user", projectAgentsDir: null, results }));
}
function output(events: unknown[]) {
	return events.map((event) => `console.log(${JSON.stringify(JSON.stringify(event))});`).join("\n");
}

describe("subagent process completion", () => {
	it("requires agent_end even after a successful message_end", async () => {
		const result = await run(output([{ type: "message_end", message: assistant() }]));
		expect(result.exitCode).toBe(1);
		expect(result.errorMessage).toContain("without agent_end");
	});
	it("accepts a complete final report and recovered prior errors", async () => {
		const result = await run(output([
			{ type: "message_end", message: assistant("partial", "error", "earlier failure") },
			{ type: "agent_end", messages: [assistant("done")] },
		]));
		expect(result.exitCode).toBe(0);
		expect(result.errorMessage).toBeUndefined();
	});
	it("rejects empty, truncated, aborted, error and missing final reports", async () => {
		for (const message of [assistant(" "), assistant("partial", "length"), assistant("partial", "aborted"),
			assistant("partial", "error"), assistant("done", "stop", "failed"), undefined]) {
			const result = await run(output([{ type: "agent_end", messages: message ? [message] : [] }]));
			expect(result.exitCode).toBe(1);
		}
	});
	it("does not substitute an earlier report for an empty final assistant", async () => {
		const result = await run(output([{ type: "agent_end", messages: [assistant(), assistant("")] }]));
		expect(result.exitCode).toBe(1);
	});
	it("drains a final JSON event without a newline on normal completion", async () => {
		const event = JSON.stringify({ type: "agent_end", messages: [assistant()] });
		const result = await run(`process.stdout.write(${JSON.stringify(event)});`);
		expect(result.exitCode).toBe(0);
	});

	it("rejects nonzero process exit even with a complete report", async () => {
		const result = await run(output([{ type: "agent_end", messages: [assistant()] }]) + "\nprocess.exit(7);");
		expect(result.exitCode).toBe(7);
	});
	it("settles abort when a descendant retains inherited output pipes", async () => {
		const controller = new AbortController();
		const running = run(`
			const {spawn} = require("node:child_process");
			const {writeFileSync} = require("node:fs");
			const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio:"inherit"});
			writeFileSync("descendant", String(child.pid));
			writeFileSync("ready", "");
			setInterval(() => {}, 1000);
		`, controller.signal);
		const directory = directories.at(-1)!;
		const timer = setInterval(() => {
			if (existsSync(join(directory, "ready"))) controller.abort();
		}, 10);
		let deadline: ReturnType<typeof setTimeout> | undefined;
		try {
			const bounded = Promise.race([running, new Promise<never>((_, reject) => {
				deadline = setTimeout(() => reject(new Error("Cancellation waited for descendant pipes")), 1000);
			})]);
			await expect(bounded).rejects.toThrow("Subagent was aborted");
		} finally {
			clearTimeout(deadline);
			clearInterval(timer);
			if (existsSync(join(directory, "descendant"))) {
				const pid = Number(readFileSync(join(directory, "descendant"), "utf8"));
				try { process.kill(pid, "SIGKILL"); } catch { /* already stopped */ }
			}
		}
	}, 1500);

	it("escalates abort for a child that ignores TERM", async () => {
		const controller = new AbortController();
		const running = run('process.on("SIGTERM", () => {}); require("node:fs").writeFileSync("ready", ""); setInterval(() => {}, 1000);', controller.signal);
		const timer = setInterval(() => {
			if (existsSync(join(directories.at(-1)!, "ready"))) controller.abort();
		}, 10);
		try {
			await expect(running).rejects.toThrow("Subagent was aborted");
		} finally { clearInterval(timer); }
	}, 4000);
});
