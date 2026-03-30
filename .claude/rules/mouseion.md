---
paths: ["mouseion/**"]
---

# Mouseion Interaction Rules

These rules apply to all work in `mouseion/` and to any agent invoking Mouseion MCP tools.

## Tool Naming

All Mouseion tools are accessed via MCP as `mcp__mouseion__<tool_name>`:
- `mcp__mouseion__query_dna_contract`
- `mcp__mouseion__write_dna_lessons`
- `mcp__mouseion__register_agent_lineage`
- `mcp__mouseion__emit_dome_event`
- `mcp__mouseion__query_merge_recipe_archive`

## Call Order on Agent Spawn

Every new agent must call these in order before taking any task action:
1. `mcp__mouseion__query_dna_contract` — load behavioral constraints
2. `mcp__mouseion__register_agent_lineage` — record existence in lineage registry

## Lesson Writing Policy

Call `mcp__mouseion__write_dna_lessons` after every task completion or failure. Include:
- `lesson_type`: one of `success | failure | insight | general`
- `niche_id`: the niche this lesson applies to
- `evidence`: array of concrete observations, not interpretations

Do not write vague lessons. "Task completed successfully" is not a lesson.

## Event Emission Policy

Emit dome events for all lifecycle transitions:
- Agent spawn → `AGENT_SPAWNED`
- Niche commitment → `AGENT_DIFFERENTIATED`
- Efficiency drop + split → `MITOSIS`
- Agent self-terminate → `APOPTOSIS`
- New organ detected → `ORGAN_FORMED`
- Dome capacity saturated → `CAPACITY_SATURATED` (with `suggested_sibling_domain` in payload)

Do not emit events for routine task execution — events are for state changes only.

## Phase 1 Constraints

`query_merge_recipe_archive` returns an empty archive in Phase 1. Do not treat empty results as an error — log with `write_dna_lessons` that no merge recipes exist yet and proceed with base models.

## MCP Server Development

The MCP server uses Node.js ESM (`"type": "module"`) with stdio transport. When modifying `mcp-server.js`:
- Keep tools count at exactly 5 (CCA Domain 2 best practice)
- All tool `fn` return plain objects — the message loop handles JSON serialization
- Never write to stdout except through `send()` — stdout is the MCP transport channel
- Use stderr for debug/status messages: `process.stderr.write(...)`
