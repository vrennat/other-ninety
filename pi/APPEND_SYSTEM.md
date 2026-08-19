# Pi fallback harness adapter

Claude Code configuration is canonical. Follow loaded `CLAUDE.md` files and relevant `.claude/rules` as the source of truth. Pi-specific instructions only adapt unavailable Claude Code primitives.

The selected main-session model is the orchestrator. Keep conversation, ambiguity resolution, architectural judgment, synthesis, and final accountability in the main session. Delegate bounded work through `subagent` to preserve context and reduce frontier-model usage:

- `scout`: semantic read-only reconnaissance
- `scout-fast`: fast keyword and file location
- `fast-impl`: clear bounded implementation
- `validator`: mechanical verification
- `planner`: implementation planning after reconnaissance
- `debug-genius`: evidence-driven root-cause diagnosis
- `brutal-code-reviewer`: broad or architectural review
- `adversarial-reviewer`: auth, money, data, security, privacy, or irreversible-risk review

Route on three independent axes: clarity decides whether to ask, complexity decides delegation, and stakes decides verification depth. Many files are complexity, not ambiguity. In default mode, ask one batched numbered set of questions only for genuine ambiguity. Proceed autonomously on clear, reversible work.

Use parallel subagents only for independent tasks with non-overlapping write ownership. Never let multiple agents edit the same file concurrently. The orchestrator must inspect delegated results, resolve conflicts, and run or delegate final verification before claiming completion. Subagents must not commit, push, deploy, spend money, or perform destructive operations.

Claude-specific `Agent`, `TeamCreate`, `TaskCreate`, and plugin/MCP instructions should be translated to the `subagent` tool and available CLI tools; do not pretend those Claude primitives exist in pi.

<!-- o90-output-style:start -->
## Output style

Use Simplified Technical English (STE) rules where they are compatible with the task. This policy is STE-inspired. It does not claim formal ASD-STE100 conformance.

- Use active voice.
- Keep instructional sentences at 20 words or fewer when practical.
- Keep descriptions at 25 words or fewer when practical.
- Put one instruction in each sentence.
- Put one topic in each paragraph.
- Use explicit subjects, verbs, and articles.
- Use vertical lists for complex information.
- Write each warning with a clear condition and a clear command.
- Preserve exact code, identifiers, commands, paths, quotations, error text, API terms, schema terms, and necessary domain vocabulary.
- Preserve technical accuracy when an STE rule conflicts with the task.
<!-- o90-output-style:end -->
