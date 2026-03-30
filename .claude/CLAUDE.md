# Organic Agentic AutoDev — Project Intelligence

## What This Project Is

A biomimicry-based framework for self-organizing agentic systems. Agents start undifferentiated (stem cells), sense their environment via a stigmergic pressure field, differentiate into specialists through task performance, and self-organize into functional organs. Built on Moltbook (social network for AI agents) with Claude Code as the orchestration layer.

Two aligned goals:
1. **Organic Agentic AutoDev** — a novel, releasable AI framework/paradigm
2. **CCA Foundations exam preparation** — every build decision maps to an exam domain

## Architecture Reference

Full architecture: [ARCHITECTURE.md](../ARCHITECTURE.md)

Key concepts:
- **Dome** = isolated Moltbook environment (container)
- **Mouseion** = shared substrate connecting domes (OpenClaw + PostgreSQL)
- **DNA Contract** = typed JSON schema: ancestral performance + behavioral constraints
- **Stem cell** = undifferentiated agent (Haiku, role_commitment = 0.0)
- **Organ** = self-organized submolt of specialized agents
- **Stigmergic substrate** = pressure field on shared artifacts (pheromone analog)

## Model Routing Policy

| Task Type | Model | Why |
|---|---|---|
| Sensing, niche scanning, bid evaluation | `claude-haiku-4-5-20251001` | High volume, low complexity |
| Discourse, synthesis, coordination | `claude-sonnet-4-6` | Balanced |
| DNA design, organ architecture, novel variants | `claude-opus-4-6` | Complex reasoning |

Always use the cheapest model that can do the job. Escalate only when complexity requires it.

## Tool Scoping Rules

- Maximum 4-5 tools per agent context (CCA Domain 2 principle)
- Tool descriptions must include: input formats, example queries, edge cases, explicit boundaries vs. similar tools
- MCP tools follow naming: `mcp__mouseion__<tool_name>`

## Agent Context Passing Rules

Subagents do NOT inherit context automatically. Every spawned agent must receive:
1. Its DNA contract (queried from Mouseion or passed directly)
2. The current dome state (active organs, pressure field summary)
3. Its task specification

Use `SubagentStart` hook to inject DNA contract automatically.

## Agentic Loop Rules

- Continue when `stop_reason == "tool_use"`
- Terminate when `stop_reason == "end_turn"`
- Use `tool_choice: "any"` for stem cell role discovery (must act)
- Use `tool_choice: {"type": "tool", "name": "..."}` for deterministic organ steps

## Output Format Requirements

All agent outputs must use structured JSON via `tool_use` (not free-text). This ensures:
- DNA contract compliance
- Mouseion can ingest findings
- Witness layer can parse observations

## Enforcement Policy

Use hooks for compliance-critical behaviors — not prompts:
- `TaskCompleted` hook → karma update + mitosis check
- `SubagentStart` hook → DNA contract injection
- `PostToolUse` hook → witness observation log
- `Stop` hook → efficiency check before session ends

Probabilistic prompt compliance is NOT acceptable for lifecycle transitions.

## File Structure

```
/workspaces/claude_architectural_study/
├── ARCHITECTURE.md           # Full system architecture
├── .claude/
│   ├── CLAUDE.md             # This file (team-wide, version controlled)
│   ├── settings.json         # Hooks configuration
│   ├── commands/             # Slash commands / skills
│   │   ├── reflexion.md      # Reflexion loop skill
│   │   ├── stem-cell.md      # Stem cell spawn skill
│   │   └── dna-evolve.md     # DNA contract evolution skill
│   ├── hooks/                # Hook shell scripts
│   │   ├── dna-inject.sh     # SubagentStart: inject DNA contract
│   │   ├── witness.sh        # PostToolUse: observation log
│   │   ├── karma-update.sh   # TaskCompleted: karma + mitosis check
│   │   └── efficiency-check.sh # Stop: efficiency evaluation
│   └── rules/
│       ├── agents.md         # Rules for agent behavior (paths: agents/**)
│       ├── mouseion.md       # Rules for Mouseion interactions
│       └── exmorbus.md       # ExMorbus-specific oncology rules
├── dome/                     # Moltbook clone (the dome runtime)
│   ├── api/                  # Express.js API
│   └── web/                  # Next.js frontend
├── mouseion/                 # Shared substrate services
│   ├── mcp-server.js         # Mouseion MCP server
│   ├── dna-store/            # DNA contract storage
│   ├── lineage-registry/     # Agent lineage tracking
│   └── event-bus/            # Inter-dome events
├── seeds/
│   └── exmorbus-v0.2.json    # ExMorbus v0.2 DNA contract
├── hooks/                    # Hook scripts (symlinked to .claude/hooks/)
└── docker-compose.yml        # Full stack deployment
```

## CCA Study Notes

This project directly covers all 5 CCA exam domains:

- **Domain 1 (27%)**: Agent lifecycle loop, hub-and-spoke Mouseion, explicit subagent context passing, hooks for deterministic enforcement
- **Domain 2 (20%)**: `.mcp.json` Mouseion config, 4-5 tool scoping, tool description quality
- **Domain 3 (20%)**: This CLAUDE.md hierarchy, `.claude/commands/` skills, `context: fork` for stem cell isolation
- **Domain 4 (18%)**: Structured JSON outputs via `tool_use`, few-shot examples in task posts, retry with error context
- **Domain 5 (15%)**: "Case facts" blocks for dome persistence, Reflexion episodic buffer, `/compact` in extended sessions

## Prior Art Reference

Key systems to reference when building (see ARCHITECTURE.md §10 for full map):
- **Reflexion** (NeurIPS '23) — dome internal learning loop
- **Stigmergic Pressure Fields** (arXiv 2601.08129) — pheromone substrate
- **AgentNet** (NeurIPS '25) — organ DAG topology
- **FunSearch Island Model** (Nature '23) — dome isolation + anti-monoculture
- **Darwin Gödel Machine** (Sakana '25) — stem cell self-modification
- **AutoResearch** (Karpathy) — experiment execution leaf nodes
