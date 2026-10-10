#!/usr/bin/env python3
"""SessionStart hook (compact): name the deferred tools that are still loaded
after a compaction, so the model calls them directly instead of reloading them.

After compaction the harness re-lists every deferred tool as "NOT loaded --
calling them directly will fail", while it keeps the schemas of tools the
session already loaded (compact_boundary.compactMetadata.preCompactDiscoveredTools).
The model believes the reminder: the 2026-10-09 session audit counted 115
ToolSearch calls in 14 days that reloaded only still-loaded tools, while 131 of
136 direct calls made in the same situation succeeded.

The loaded set is the latest compact boundary's preCompactDiscoveredTools plus
every tool a ToolSearch result referenced after it. This holds whether or not
the boundary for the compaction in progress has been written yet (it usually
lands just after this hook runs). Across 740 consecutive boundary pairs the
harness carried the full set forward in 732; the printed fallback covers the
rest. Fails soft: any error prints nothing and exits 0.
"""

from __future__ import annotations

import json
import sys


def loaded_tools(transcript: str) -> list[str]:
    names: set[str] = set()
    with open(transcript, encoding="utf-8") as lines:
        for line in lines:
            if "preCompactDiscoveredTools" not in line and "tool_reference" not in line:
                continue
            record = json.loads(line)
            if record.get("type") == "system" and record.get("subtype") == "compact_boundary":
                metadata = record.get("compactMetadata") or {}
                names = set(metadata.get("preCompactDiscoveredTools") or [])
                continue
            content = (record.get("message") or {}).get("content")
            if record.get("type") != "user" or not isinstance(content, list):
                continue
            for block in content:
                if block.get("type") == "tool_result" and isinstance(block.get("content"), list):
                    names.update(
                        item["tool_name"] for item in block["content"]
                        if item.get("type") == "tool_reference" and item.get("tool_name")
                    )
    return sorted(names)


def main() -> int:
    payload = json.load(sys.stdin)
    if payload.get("source") not in (None, "compact"):
        return 0
    transcript = payload.get("transcript_path")
    if not transcript:
        return 0
    names = loaded_tools(transcript)
    if not names:
        return 0
    print(
        "Deferred tools loaded before this compaction are still loaded; call them directly, "
        f"without ToolSearch: {', '.join(names)}. The post-compaction reminder that lists "
        "them as not loaded is wrong for these tools. If a direct call fails with "
        "InputValidationError, load that tool with ToolSearch and retry."
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
