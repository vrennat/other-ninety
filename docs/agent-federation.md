# Agent provenance and federation

Status: design direction, not shipped behavior.

The smallest credible next step for o90 is best-effort local run telemetry, not
a network of autonomous agents. Record what one Pi boundary reports, make it
useful through a tiny reader, and defer provenance claims, remote identity,
signatures, and discovery until a real trust boundary exists.

## The strongest objection

An agent-authored Markdown timeline is a useful diary, but it is not evidence.
The same agent can omit an event, misname its model, overstate what it verified,
or rewrite the file later. Adding keys and signatures to that self-report does
not fix the observation problem; it only proves which key signed the claim.

A recorder outside the worker improves the observation point, but a process
boundary is not an integrity boundary. Today a write-enabled worker runs as the
same user, can reach absolute paths, and can alter the private state root. File
permissions and append-only writer behavior prevent accidents and races; they
do not prevent a compromised worker or local account from rewriting history.

The first version therefore calls its output telemetry. It excludes worker and
local-account tampering from its threat model. Calling the records provenance
requires filesystem confinement that excludes the state root, a separately
privileged recorder, or an equivalent enforcement boundary.

This design separates four assurances that are easy to conflate:

| Assurance | Meaning | o90 state |
|---|---|---|
| Attribution | A label says which runtime, role, model, and host produced work. | The optional `Agent:` trailer exists today. |
| Observed lineage | A runtime boundary records what it launched and received, without claiming tamper resistance. | Best-effort telemetry proposed here. |
| Verifiable provenance | An integrity boundary binds executions, authority, artifacts, and checks in records the worker cannot rewrite. | Deferred until o90 has that boundary. |
| Attested federation | Another principal can verify identity, delegation, integrity, revocation, and transport. | Explicitly deferred. |

Authorization is separate from all four. Telemetry says what an observer
reported; only an enforcement boundary can decide whether an action was
allowed, and only an integrity boundary can make that report trustworthy to a
different principal.

## Questions a mature record must answer

1. What durable agent definition produced this work, and what exact definition
   version ran?
2. Which execution produced it, under whose authority, what scope was requested
   and granted, and which boundary actually enforced that scope?
3. What parent run, task, decision, or tool result caused this execution?
4. What artifact was produced, and what observed checks support its outcome?
5. Can another runtime continue the task without replaying or trusting a chat
   transcript?

The record does not need chain-of-thought, full prompts, raw tool payloads, a
global reputation score, or a central orchestrator to answer those questions.
Slice 1 intentionally answers only which child invocation ran, what was
requested, what the runtime reported, and how it terminated.

## What exists now

o90 currently federates configuration, not agents:

- Claude, Codex, Cursor, and Pi receive native forms of the same skills and role
  names.
- Pi can launch fresh-context local child agents that still share the host
  filesystem, and the optional host-to-Pi bridge can run one bounded leaf task.
- The conductor workflow defines exclusive authority, refusal rights, gates,
  and durable roles in prose.
- Claude records a deliberately lossy list of recent sessions so parallel work
  is visible.
- The optional Git/comment trailer records
  `Agent: <harness>/<role> · <model> · <host>`.

None of these creates a stable agent-definition or run identity, causal lineage,
an artifact binding, a capability exchange, or a trust relationship. Git can
extract the free-text `via` suffix as a positional field, but it is neither a
typed nor a multi-hop causal edge.

Adoption is also too sparse for self-reporting to be the base layer. From the
trailer convention's introduction through the repository state inspected on
2026-09-01, 4 of 30 commits had any `Agent` trailer and only one used the full
current shape.

## What to borrow from Geet Duggal

The useful transfer is the management model, not the literal syntax.

### Home over occupant

Geet's [Folder over Agent](https://geetduggal.com/order-home/folder-over-agent-file-over-app/)
argument makes the human-owned place durable and the agent temporary. In o90,
the repository, work item, and evidence survive the model or harness that works
on them. An agent is a contractor invited into the workspace, not the owner of
its structure or memory.

### Space and time are different

[Spacetime.md](https://geetduggal.com/order-home/spacetime-md-a-minimal-plain-text-format-for-mapping-your-daily-work/)
treats space as a tree and time as a log. The o90 translation is:

- **Space:** principals, federation nodes, agent definitions, workspaces, and
  artifacts each have one durable home.
- **Time:** runs, delegations, handoffs, decisions, checks, revocations, and
  artifact observations are append-only events.
- **Relationships:** trust and causality are explicit edges. They are not forced
  into the containment tree.

Clock time is not causal order. Every event also needs an ID and a causal parent
when one exists; federated issuers may eventually need their own sequence or
checkpoint to support completeness claims.

Geet's three tests translate cleanly if they are treated as view invariants:

- **Composability:** independently recorded event sets can be combined without
  rewriting either source.
- **Completeness:** a view that shows a run also shows every directly known
  child, or says that children were filtered or may be missing.
- **Habitability:** the normal interface is a brief, pins, and readable
  timeline; the canonical JSON is an inspectable substrate, not the manager's
  daily workspace.

The complete-child rule applies to a rendered view, not to identity. Delegation
and artifact causality form a graph, so forcing the whole system into a folder
tree would hide real relationships.

### One main document, a few pins, and the log

Geet's updated
[filesystem convention](https://geetduggal.com/order-home/tech-habits-the-file-name-and-folder-convention-to-rule-them-all/)
uses one `!` main document, a small `$` pinned set, dated entries, and arbitrary
supporting artifacts. This is a strong management view for each durable agent or
work item:

- one current brief: purpose, authority, current state, and next action;
- a bounded pinned set: active gates, commitments, decisions, and warnings;
- an append-only history: runtime telemetry and explicit handoffs;
- native artifacts: diffs, commits, test output, screenshots, documents, and
  other formats stay first-class rather than being flattened into prose.

Keep the information hierarchy; the `!` and `$` punctuation is optional.

### Metadata has one job at a time

The updated article's small frontmatter vocabulary is useful if o90 keeps the
same separation of concerns:

- a `slug`-like value becomes a stable, issuer-scoped ID, independent of a
  display name, filename, or current path;
- `public` becomes an explicit export policy, never an inference from where a
  file happens to live;
- `folded` remains a view preference and cannot affect retention, trust, or
  authorization;
- `url` becomes an external artifact or source reference, paired with a digest
  when content identity matters.

Paths provide human context and dated filenames aid navigation. Neither is a
durable identity or proof of when an event occurred.

### Raw evidence and current synthesis are both necessary

The supplied Notable Folders article separates a raw chronological log from one
curated main document. o90 should do the same. A manager needs a fast answer to
"what is true now?" and a path from every material statement back to evidence.

Summaries must remain claims. Promotion from observation to current guidance is
an explicit, attributable transition; it never deletes or silently rewrites the
source event.

### Durable accountability over transient projects

"People over projects" should not become dossiers or anthropomorphic agent
profiles. The transferable rule is to organize durable knowledge around the
accountable principal and versioned agent definition that outlive a task. A
display name or role is not identity, and a changed prompt, tool set, model
policy, or operator can mean a materially different definition or accountable
principal.

### Bounded active sets and deliberate graduation

Geet keeps only a handful of active projects and promotes material from a log
only when it earns a durable home. o90 already has the same instinct in its
ladder. Federation should begin only after worktrees and status stop being
enough.

A new standing agent role should likewise have a high bar: distinct authority,
a distinct reporting contract, or a materially different verification lane.
Topic labels alone do not justify a new agent.

### Seasons are a better unit for routing experiments

Model, prompt, role, and routing changes should be evaluated in named, bounded
seasons. Record the exact configuration digest and compare representative work
inside the season. Do not change several routing variables at once and then
attribute the outcome to whichever one is most interesting.

Counts such as commits, tasks, or tokens are inventory, not quality. Any claimed
improvement needs a defined outcome, sample size, variance or uncertainty, and
the failures that were included.

### Make the hierarchy an operating cadence

The management value comes from a small repeated loop, not from naming every
file perfectly:

1. Capture observations during work without stopping to classify them deeply.
2. At handoff, update one current brief from those observations and cite the
   evidence behind each material claim.
3. On a regular review cadence, clear stale pins, graduate durable decisions,
   and archive inactive work.
4. At the end of a season, evaluate the role and routing configuration against
   named outcomes before starting the next experiment.

This keeps operational truth current without asking a manager to reconstruct
it from transcripts or treating an automatically generated summary as truth.

### Build the register from evidence, not a questionnaire

A future `$ Active agents` register should be a projection of installed
definitions, policy configuration, and observed runs. Each row has five jobs:

- stable agent ID and exact definition digest;
- stated purpose and accountable principal;
- requested authority, authorization reference, and separately observed
  enforcement;
- lifecycle state, review date, and expiry when appropriate;
- last observed run and the adapters that can or cannot see it.

An unknown owner, authority, or expiry is displayed as a finding; o90 never
guesses it from a username or prompt. This preserves Geet's one-main-document
discipline without creating a second manually maintained source of truth.

### One truth, many disposable views

The filesystem article's deeper rule is to avoid dual writes. A timeline,
status dashboard, task view, and causal graph should be derived from the same
event records. Do not require agents to update a tracker, Markdown log, commit
trailer, and session file independently.

### Strict seams, flexible contents

Geet is strict about filenames and directory boundaries while allowing many
artifact formats inside. o90 should be strict about IDs, causal links, scope,
timestamps, digests, and cardinality, while allowing task-specific payloads and
artifacts through versioned extensions.

The published filename grammar is inspiration, not a ready parser contract. Its
`event` production does not include the titles used by its own examples. A real
o90 format needs executable valid, invalid, round-trip, merge, and adversarial
fixtures rather than a grammar-looking block alone.

## Evidence from Reddit

On 2026-09-01, research covered 23 distinct threads across 11 communities.
This was query-driven public search, not a representative sample. Deleted,
private, poorly indexed, and deep comments are underrepresented; scores drift;
and recent agent-security discussions contain substantial vendor promotion.
Treat the threads as recurring practitioner signals, not verified incident
reports or market measurements.

The recurring signals were:

- Handoffs lose rationale, rejected approaches, unrun tests, and the immediate
  next action. A diff preserves state but not intent.
- Flat logs say what happened but often omit the parent-child path, policy,
  model, prompt/role, tool, retrieval, and environment versions that explain
  why it happened.
- Shared credentials flatten the human principal and every child agent into one
  actor. Delegated scope often fails to narrow.
- Authorization enforced only inside the agent is bypassable. Practitioners
  prefer process, gateway, credential, or tool boundaries.
- Local-first users value plain files, but expect backups, proposed diffs, and
  explicit review before agent writes become durable truth.
- MCP and A2A help different interoperability layers, but neither is treated as
  a substitute for provenance or fine-grained authorization.

Full retained corpus, with labels shortened where the original title was long:

**Identity, authority, and audit**

- [MCP is a security joke](https://www.reddit.com/r/mcp/comments/1le81tq/mcp_is_a_security_joke/)
- [Worst MCP security horror stories](https://www.reddit.com/r/mcp/comments/1uz8pqk/your_worst_mcp_security_horror_stories/)
- [Audit of authorization in 30 AI-agent frameworks](https://www.reddit.com/r/netsec/comments/1ruefpo/we_audited_authorization_in_30_ai_agent/)
- [Where should agent permissions be enforced?](https://www.reddit.com/r/AI_Agents/comments/1vvfq9v/where_should_an_ai_agents_permissions_actually_be/)
- [Multi-agent authorization and delegation chains](https://www.reddit.com/r/AI_Agents/comments/1sn519l/multi_agent_authorization_delegation_chain/)
- [What should an AI-agent audit trail capture?](https://www.reddit.com/r/mlops/comments/1vf5rsu/what_should_an_ai_agent_audit_trail_capture/)
- [Struggling with AI auditability](https://www.reddit.com/r/AI_Agents/comments/1vsn3yb/anyone_else_struggling_with_ai_auditability/)

**Federation and observability**

- [Google launched A2A](https://www.reddit.com/r/LocalLLaMA/comments/1jvc768/google_just_launched_the_a2a_protocol_were_ai/)
- [Debugging multi-agent systems in production](https://www.reddit.com/r/LangChain/comments/1nsm96e/how_do_you_actually_debug_multiagent_systems_in/)
- [Meaningful observability for agents](https://www.reddit.com/r/LangChain/comments/1uoxsft/how_do_you_get_meaningful_observability_for/)
- [The observability gap in AI pipelines](https://www.reddit.com/r/mlops/comments/1uvodsx/the_observability_gap_in_ai_pipelines_is_way/)

**Memory and handoff**

- [Why a multi-agent pipeline kept failing](https://www.reddit.com/r/AI_Agents/comments/1rx8ot0/the_reason_my_multiagent_pipeline_kept_failing/)
- [Agentic project management workflow](https://www.reddit.com/r/cursor/comments/1l2p2y6/agentic_project_management_my_ai_workflow/)
- [CLAUDE.md and context-compaction loss](https://www.reddit.com/r/ClaudeAI/comments/1tuvtk8/claudemd_that_solves_the_compactioncontext_loss/)
- [Context handoff between coding agents](https://www.reddit.com/r/cursor/comments/1v8d9ha/how_should_context_handoff_work_between_coding/)

**Plain text and local-first work**

- [Obsidian tracks all of my work](https://www.reddit.com/r/ObsidianMD/comments/1bx1atc/obsidian_tracks_all_of_my_worknot_my_second_brain/)
- [Short daily logs in Obsidian](https://www.reddit.com/r/ObsidianMD/comments/1sjjoft/how_do_you_keep_short_daily_logs_in_obsidian_one/)
- [Who uses todo.txt files?](https://www.reddit.com/r/productivity/comments/svk9si/who_uses_todotxt_files/)
- [Obsidian as an AI-agent memory substrate](https://www.reddit.com/r/ObsidianMD/comments/1qo25ge/what_do_you_think_of_obsidian_seemingly_being_the/)
- [AI privacy concerns in a personal vault](https://www.reddit.com/r/ObsidianMD/comments/1rzgiq0/ai_sucks_up_all_the_information_like_a_vacuum/)
- [Agents, skills, and destructive edits](https://www.reddit.com/r/ObsidianMD/comments/1t163qh/agentsmd_file_skills_repo/)
- [A local, private AI vault](https://www.reddit.com/r/ObsidianMD/comments/1qw4muz/my_goal_obsidian_vault_with_local_private_ai/)
- [A local-first knowledge app with reviewed agent diffs](https://www.reddit.com/r/sideprojects/comments/1szqxuo/i_built_a_localfirst_knowledge_app_with_ai_agents/)

## What the second security research pass changes

The useful correction is that identity and task authority are orthogonal. An
agent may have a stable workload identity while acting for different subjects,
with different scopes, audiences, and expirations on each run. Saying an agent
is categorically "not a principal" is too strong; treating its stable identity
as standing authority is the dangerous mistake.

[RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html) already separates the
subject from the actor in delegated token exchange, and current
[Microsoft Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/agent-tokens)
similarly keeps user subject context distinct from agent facets. o90 should
therefore keep five records separate: accountable principal, logical agent
definition and version, runtime execution identity, per-run authorization, and
observer. None is inferred from another.

### Provenance has two planes

- **Supply-chain provenance:** which o90 revision, role, skill/plugin bundle,
  runtime build, tool server, and exact tool definitions were loaded.
- **Action provenance:** which run requested or performed an action, for which
  subject, under what enforced authority, with what result and artifact.

The February 2026
[SANDWORM_MODE investigation](https://socket.dev/blog/sandworm-mode-npm-worm-ai-toolchain-poisoning)
made the first plane concrete: malicious npm packages installed rogue MCP
servers into coding-agent configurations. A clean action log from a poisoned
toolchain is not sufficient.

The target definition digest should therefore cover role instructions, model
policy, relevant o90 policy, and resolved skill/plugin/tool-manifest references.
Runtime and tool-definition digests remain separate observed fields so a
changed server description cannot hide behind a stable role name. Slice 1
records only the local role source, runtime build, and tool allowlist it can
actually see. Signed tool manifests, curated registries, and re-attestation are
later controls for third-party tool boundaries, not claims made by local
telemetry.

The governance evidence is directional, not a benchmark. The
[CSA/Oasis survey](https://cloudsecurityalliance.org/press-releases/2026/01/27/79-of-it-pros-feel-ill-equipped-to-prevent-attacks-via-nhi-csa-oasis-survey-finds)
had 383 respondents and was vendor-commissioned; the
[Gravitee survey](https://www.gravitee.io/blog/state-of-ai-agent-security-2026-report-when-adoption-outpaces-control)
is also vendor research. They support accountable ownership and explicit
identity lifecycles, not a claim that their percentages generalize to o90
users. NIST's current work is an
[initiative](https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure)
and an [NCCoE concept paper](https://www.nccoe.nist.gov/projects/software-and-ai-agent-identity-and-authorization),
not an implementation standard. Regulatory dates may affect a deployer's
retention or disclosure policy, but they do not define o90's identity model.

## Minimal architecture

The first version has two moving parts:

1. One small `o90-receipt` command with `append`, `recent`, `show`, and `purge`
   operations.
2. One adapter in the Pi subagent extension, the richest boundary o90 already
   controls.

```text
Pi parent -- native tool-call reference --> child run
   |                                      /    |
   | requests role/model/tools           /     | returns status/model/output
   v                                    v      v
run.requested -----------------------> run.finished
                    o90-receipt
                         |
                         +--> recent / show
```

The command stores one append-only event per file under the private o90 state
root:

```text
${OTHER_NINETY_STATE_DIR:-~/.local/state/other-ninety}/provenance/
├── events/
    └── 2026-09-01/
        └── <timestamp>_<event-id>.json
└── tombstones/
    └── <event-id>.json
```

One file per event avoids the concurrent-append and merge ambiguity of one
shared JSONL file. Write a private temporary file in the destination directory,
sync it, install the final name with no-replace semantics, and sync the
directory. Readers ignore temporary files and reject invalid final files. The
writer never updates a final event in place. This is an append-only contract,
not tamper evidence against the local account. Logical corrections and
supersessions are new events. A privacy deletion may physically remove
sensitive data under the retention policy and must not be described as
cryptographically complete history afterward.

`purge` removes selected local event bytes and writes a separate, non-event
tombstone containing only the event ID, original digest, and purge time. This
keeps Slice 1's event vocabulary at two types while preventing accidental
reimport. A user may remove the tombstone too, accepting that the reader can no
longer detect resurrection of an old copy.

The state root is private by default because run metadata can expose local
paths, host aliases, models, tasks, and artifact names. A repository can opt in
to a sanitized export. Public provenance remains off unless the repository
deliberately adopts it.

Slice 1 is useful against routine omission and ambiguity: instrumented runs are
captured automatically, concurrent writers do not clobber one another, and a
manager can query an exact run without reading a transcript. It does not defend
against a malicious worker, runtime, adapter, or local user; uninstrumented
runs; a false host clock; or artifact misattribution. Those exclusions are
shown by `show` and included in any export.

### Future agent definition card: space

The first slice embeds its definition digest in each run. If repeated runs make
a registry useful later, an agent definition card can describe a reusable
logical role and one exact definition version. Stable identity and version stay
separate so a role can evolve without losing its history:

```json
{
  "schema": "o90.agent-definition/v1",
  "agent_id": "o90:local:<principal-namespace>:fast-impl",
  "definition_digest": "sha256:<canonical-definition-digest>",
  "accountable_principal_id": "local:<configured-alias>",
  "role": "fast-impl",
  "purpose": "bounded implementation worker",
  "requested_capability_profile": "pi-tools:read,write",
  "lifecycle": {
    "status": "active",
    "review_after": "2026-12-01T00:00:00Z",
    "expires_at": null
  }
}
```

`agent_id` is the principal-scoped continuity key. `definition_digest` covers a
canonical manifest of the role instructions, requested model policy, tool and
capability requirements, and relevant o90 policy. The actual runtime, requested
and runtime-reported models, observed tool allowlist, and enforced sandbox belong
to the run. A role name can remain unchanged while definition inputs change, so
every run records the digest as its exact version. A future registry stores
cards by both values, for example
`definitions/<agent-id>/<definition-digest>.json`; a new version never
overwrites an old one. The local principal alias and capability profile are
configured claims, not verified identity or proof of enforcement. The
accountable principal owns the definition's purpose and lifecycle; it is
distinct from the subject on whose behalf any particular run acts.

### Run event: time

Every event uses the same small envelope. Event-specific content lives under
`data`:

```json
{
  "schema": "o90.event/v1",
  "event_id": "urn:uuid:<observer-generated-uuid>",
  "event_type": "run.requested",
  "observed_at": "2026-09-01T12:34:56.789Z",
  "observer": {
    "component": "pi-subagent-adapter",
    "build_digest": "sha256:<adapter-and-writer-digest>"
  },
  "run_id": "urn:uuid:<observer-generated-uuid>",
  "parent_run_id": "<parent-run-id-or-null>",
  "caused_by_event_ids": [],
  "native_cause": { "kind": "pi.tool-call", "id": "<tool-call-id>" },
  "native_session": null,
  "task_id": "<work-item-id-or-null>",
  "agent_id": null,
  "definition_digest": "sha256:<canonical-definition-digest>",
  "authority": {
    "subject_principal_id": null,
    "requested_scope": ["tool:read", "tool:write"],
    "authorization_ref": null
  },
  "execution": {
    "runtime": {
      "name": "pi",
      "build_digest": "sha256:<runtime-build-digest>"
    },
    "model": {
      "requested_provider": "<provider-or-null>",
      "requested_model": "<model-or-null>",
      "runtime_reported_provider": "<provider-or-null>",
      "runtime_reported_model": "<model-or-null>",
      "response_model": "<model-or-null>"
    },
    "tools": {
      "observed_allowlist": ["read", "write"],
      "manifest_source": null,
      "manifest_digest": null
    },
    "enforced_scope": null,
    "host_alias": "<privacy-safe-alias-or-null>",
    "repository": "<configured-id-or-null>",
    "worktree": "<configured-id-or-null>"
  },
  "data": {}
}
```

Slice 1 has only two event types:

- `run.requested`
- `run.finished`

Their payloads are deliberately small:

```json
{
  "run.requested": {
    "role": "fast-impl",
    "definition_source": "project",
    "cwd_policy": "inherit",
    "task_body_retained": false
  },
  "run.finished": {
    "outcome": "success",
    "exit_code": 0,
    "signal": null,
    "runtime_stop_reason": "stop",
    "duration_ms": 1234,
    "output": {
      "source": "assistant_text",
      "encoding": "utf-8",
      "bytes": 456,
      "sha256": "sha256:<digest>"
    }
  }
}
```

`run.requested` means the launch attempt began, not that an OS process definitely
exists. `run.finished.caused_by_event_ids` contains its `run.requested` event.
The Pi tool-call reference is a typed native cause, not a known parent run; a
future session reference gets its own typed field. Empty strings are invalid.
Parent run, native session, task, subject principal, model/provider observations,
agent, tool manifest, enforced scope, host, repository, worktree, exit code,
signal, and runtime stop reason are nullable exactly where the boundary may not
know them. The adapter never derives them from a username, path, prompt,
role-name match, or requested model. Same-named roles in different runtimes are
not the same agent unless an explicit mapping says so. `definition_source`
records whether Pi selected the project or user role definition; it does not
store the source path.

`outcome` is exactly `success`, `nonzero`, `aborted`, `launch_error`,
`runtime_error`, or `signal`. Keep the observed exit code, OS signal, and
runtime-reported stop reason in separate fields. In particular,
`runtime_error` may have exit code `0`; `launch_error` means no child process was
observed; and `signal` names the terminating signal even when exit code is
`null`. Duration is a non-negative measurement from a monotonic clock; wall
time remains display metadata.

The output digest covers the exact, untruncated per-child text that the adapter
returns to its caller, encoded as UTF-8 before any parallel-result aggregation
or presentation truncation. `source` is exactly `assistant_text`,
`runtime_error`, `stderr`, or `none`, so fallback error text is not mistaken for
an assistant answer. It never hashes a rendered multi-child summary.

Later adapters may add `delegation.declared`, `handoff.claimed`,
`artifact.observed`, `verification.observed`, and `verification.verdict`. Only
the component that enforces a decision may emit `authorization.decided`,
`authorization.denied`, or `authorization.revoked`.

Do not log chain-of-thought. Full prompts, tool inputs, outputs, and file bodies
are also off by default. Store hashes or private references when they are needed
for reproducibility, with a separate retention policy for sensitive bodies.
Never serialize Pi's complete result object: it can contain the task text,
messages, tool results, standard error, and other sensitive bodies.

Observed fields and agent claims stay visibly separate. The adapter can observe
requested arguments, times, native runtime events, termination status, the
configured tool allowlist, and returned bytes. Provider and model values are
labeled by their requested, runtime-reported, or response-reported source rather
than presented as independently verified. A worker
can claim why it chose an approach, which alternatives it rejected, or whether
it believes the task is complete. A verifier can later add a separate verdict.
None of those claims is silently upgraded to observation.

`requested_scope` and `authorization_ref` describe policy intent. The
observed tool allowlist says which Pi tools the adapter configured; it does not
imply that an ordinary process lacked ambient filesystem, credential, or
network access. `enforced_scope` stays `null` until a boundary can name its
mechanism and policy digest. A receiver must intersect the parent claim with
its own policy and record what it actually enforced.

A future non-null `authorization_ref` stores metadata or a private reference,
never the bearer credential itself: token/profile kind, issuer, audience,
subject, actor-chain digest, granted constraints, expiry, proof-of-possession
binding, and the enforcing decision event. Carrying an `act` chain is a
representation of delegation; it is not by itself proof that every hop was
authorized or cryptographically bound.

Artifact binding is outside Slice 1. A future caller-side adapter may record
baseline and post-run Git state, but a shared or already-dirty workspace
supports at most the claim that the boundary reported a state change. Attribute
an artifact to a run only when an exclusive worktree, explicit output directory,
commit boundary, or equivalent mechanism excludes concurrent writers.

### Human projection

The first reader renders recent runs without asking agents to maintain another
log:

```text
2026-09-01 1234 fast-impl requested cause=pi.tool-call:<id> parent=unknown
2026-09-01 1241 fast-impl finished  status=success model=<reported>
2026-09-01 1245 review-a   requested parent=unknown
```

If the view changes a real management decision, later projections can add the
Geet-inspired current brief, pins, and timeline. The existing `Agent:` trailer
remains self-reported attribution until a caller-side commit adapter can bind it
to a run; Slice 1 does not generate it.

## Federation boundary

For o90, federation means independent runtimes can exchange a task and return
artifacts while preserving source identity, delegation, and causal references.
The receiving runtime creates a distinct execution record; it does not inherit
the source agent definition's identity or principal's authority merely by
copying its envelope. The runtimes do not share one transcript, one mutable
memory, or one master agent.

Use existing protocols only at their actual boundaries:

| Boundary | What o90 should use | What it does not establish |
|---|---|---|
| [A2A 1.0](https://github.com/a2aproject/A2A/blob/main/docs/specification.md) | Export Agent Cards and adapt remote tasks, messages, and artifacts rather than inventing a wire protocol. | Card signing is optional and binds card integrity/origin, not agent behavior, tool integrity, or authorization. |
| [MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) | Connect hosts to context and tools with its negotiated capabilities and protected-server authorization. | It does not name the reasoning agent or provide artifact lineage. |
| [OAuth token exchange](https://www.rfc-editor.org/rfc/rfc8693.html) | Preserve subject, actor, audience/resource, scope, and expiry semantics when a real authorization server is present. | The base RFC deliberately leaves token security characteristics and deployment trust policy to profiles. |
| [SPIFFE federation](https://spiffe.io/docs/latest/spiffe-specs/spiffe_federation/) | Authenticate workloads across administratively separate trust domains when o90 is deployed in infrastructure that already uses SPIFFE/SPIRE. | Workload identity is not user delegation, task intent, or action provenance. |
| [RFC 9421 HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html) | Authenticate a remote HTTP request when end-to-end request signing is required. | A valid signer is not proof of who authorized the task or what the agent did locally. |
| [W3C PROV](https://www.w3.org/TR/prov-primer/) | Preserve the conceptual distinction among agents, activities, and entities. | o90 need not adopt its full serialization for local telemetry. |

The newer agent-specific work is a watchlist, not a dependency set. The
[OAuth Actor Profile](https://datatracker.ietf.org/doc/draft-mcguinness-oauth-actor-profile/),
[Transaction Tokens for Agents](https://datatracker.ietf.org/doc/html/draft-araut-oauth-transaction-tokens-for-agents),
[Attenuating Authorization Tokens](https://datatracker.ietf.org/doc/draft-niyikiza-oauth-attenuating-agent-tokens/),
[Web Bot Auth](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-httpsig-protocol/01/),
and [ANS v2](https://www.ietf.org/archive/id/draft-narajala-courtney-ansv2-00.html)
are active or individual Internet-Drafts. Their actor typing, attenuation,
hop-count, request-signing, and transparency-log ideas are useful test cases,
but their field names and trust models must remain replaceable adapters.
[XAA](https://www.okta.com/newsroom/articles/secure-by-design-why-every-connection-matters-in-the-era-of-ai-agents/)
and [Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/agent-tokens)
are useful commercial validation of external policy and split subject/actor
identity, not canonical o90 protocols.

Remote federation triggers an explicit threat-model review. Offline verification
may require signatures and key rotation; incomplete or adversarial event
exchange may require issuer checkpoints and replay protection; delegated
authority may require revocation and trust anchors; concurrent issuers may need
partial-order merge rules. Authenticated transport plus trusted storage can
cover simpler cases, so o90 should add only the mechanisms the trust model
requires.

## Implementation sequence

### Slice 1: best-effort Pi telemetry

Implement `bin/o90-receipt` as a dependency-free Python executable and have
`scripts/install.py` install it with the Pi component. The installer passes its
resolved path to the extension; the adapter does not depend on an ambient PATH.
It is a one-shot file utility, not a daemon, orchestrator, or mandatory wrapper.

Instrument only:

- `pi/extensions/subagent/index.ts`

The extension has the richest current seam: named role and tool configuration,
the native tool-call reference, structured child events, and the returned
result. It assigns the run ID, emits `run.requested` before launch, and emits
`run.finished` only when it observes a terminal result. A persisted start with
no finish remains interrupted or unknown; crashes, kills, and writer failure
cannot be made to produce a reliable terminal event after the fact.

Capture requested provider/model, runtime-reported provider/model, and response
model separately. Today Pi initializes its result with the requested configured
model and only uses the worker-reported model when the field is empty, which can
conflate intent with execution. Store `null` rather than inventing a resolved
value when the runtime does not report one. Hash the installed Pi runtime for a
build identifier because the package currently has no version field. Embed the
definition digest in the two events; do not build a definition registry yet.

Telemetry remains a record, not a gate. If the request append fails, the adapter
surfaces a visible warning, disables telemetry for that invocation, and
continues the child run rather than creating an orphan finish. If the finish
append fails, it preserves the child's original result and reports the telemetry
failure separately. It never changes a successful task into a failed task merely
because local telemetry is unavailable.

Acceptance criteria:

- every child invocation gets a unique run ID and retains its native tool-call
  reference; `parent_run_id` is `null` when unavailable;
- when the request append succeeds, `run.requested` is durable before launch, and a
  finish preserves success, non-zero exit, caught abort, launch error,
  runtime-reported error, or signal termination without collapsing them;
- parallel writers never overwrite one another, identical replays are
  idempotent, and the same ID with different content is an error;
- the definition digest changes for role, model policy, tool, capability, or
  relevant policy changes, with canonicalization covered by golden fixtures;
- project/user definition origin, runtime build, and each model/provider source
  remain distinct nullable fields;
- sensitive bodies are absent by default;
- exact per-child caller-return text is represented by source, UTF-8 byte length,
  and SHA-256 digest unless body retention is explicitly enabled;
- `recent` and `show <run-id>` render the same events deterministically;
- malformed, conflicting, unknown-version, truncated, cyclic, and multiply
  terminal runs fail visibly;
- no artifact, verification, authorization, or `Agent:`-trailer claim is
  emitted by this slice;
- documentation and output call the result telemetry, not tamper-resistant
  provenance.

### Escalate only when the first slice is used

Instrument `bin/o90-pi` and `claude/plugin/scripts/pi_worker.py` only when their
callers can pass a native parent reference and capture structured results. Add
caller-side artifact and verification events only at the boundary that performs
the commit or check.

Add native Claude, Codex, and Cursor lifecycle adapters after local telemetry
proves useful. [Claude](https://code.claude.com/docs/en/hooks),
[Codex](https://learn.chatgpt.com/docs/hooks), and
[Cursor](https://cursor.com/docs/hooks) currently expose session, tool,
and subagent lifecycle events in different shapes. Each adapter must preserve
native IDs and distinguish what its boundary actually observed; similar event
names do not imply equal semantics or enforcement strength.

Add `/status` integration if the small reader changes management decisions and
people want the view in-band. Add an integrity boundary, signatures, or A2A
transport only when the relevant threat model or cross-principal use case calls
for them. Add a registry only when direct configuration no longer answers
discovery.

## Reliability and privacy rules

- Event-set merge is union by append-only `event_id`: associative,
  commutative, and idempotent. The same ID with different bytes is an integrity
  error, never last-write-wins.
- Event and definition bytes use the
  [JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) before
  SHA-256 hashing. IDs use cryptographically random UUIDs; exclusive final
  creation prevents overwrite, and readers require exactly one request and at
  most one terminal event per run.
- Reader display order is `(observed_at, event_id)` for determinism. Wall-clock
  timestamps are display metadata, not a total or causal order.
- The observer, not the worker, assigns event and run IDs and observed times.
- Causal references may be absent or unresolved when a run starts outside o90;
  readers show the gap and reject cycles rather than inventing a root.
- Delegated authority can only narrow as policy; a receiver validates and
  enforces the intersection at its own boundary. Telemetry does not make an
  unenforced grant real.
- Only an enforcing component records authorization decisions and denied
  attempts. Only the component that runs a check records the command and exit
  status; a separate verifier owns any semantic verdict.
- A handoff includes current goal, relevant decisions, rejected paths, active
  constraints, unrun checks, uncertainty, artifact references, and the next
  unresolved action. It is a claim event, not standing instructions.
- Agent-to-agent notes remain outside `AGENTS.md`, `CLAUDE.md`, and other
  auto-loaded instruction paths.
- A human can inspect, correct, supersede, export, and purge local records under
  an explicit retention policy. Purge cannot recall prior exports; any retained
  tombstone contains only the non-sensitive ID and digest, blocks accidental
  reimport, and makes readers stop claiming completeness across the gap.
- Public exports omit host, local path, prompt, and sensitive task data unless
  each field is deliberately allowed.

## What would make this too small

Revisit the design when one of these is observed:

- two principals need to verify each other's receipts;
- concurrent federation nodes cannot determine completeness;
- mid-flight revocation must propagate across machines;
- one task crosses enough runtimes that direct configuration cannot discover
  the next agent;
- event volume makes file-per-event reads materially slow;
- compliance requires tamper evidence beyond a private local state directory;
- artifact bodies need selective disclosure rather than private references.

Until one of these conditions occurs, stop at local telemetry.
