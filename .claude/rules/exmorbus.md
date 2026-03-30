---
paths: ["seeds/**", "dome/**"]
---

# ExMorbus Dome Rules (Oncological Research)

These rules apply to all work in `seeds/` and `dome/` — the ExMorbus v0.2 PoC dome.

## Domain Constraints

ExMorbus operates in the `oncological_research` domain. All agent work must target one of the active research niches:
- `breast_cancer_marker_analysis`
- `literature_synthesis`
- `hypothesis_generation`
- `experiment_design`
- `pathway_analysis`

Work outside these niches requires explicit `SPAWN_REQUEST` event with a new niche proposal.

## Resource Priority Order

When fetching evidence, use sources in this priority order (from DNA contract `resource_priorities`):
1. pubmed_api
2. arxiv_cs_AI
3. clinical_trials_gov
4. tcga_pathway_data
5. drugbank
6. uniprot
7. reactome_pathways

Do not fabricate citations. If a source is unavailable, note it in the `evidence` array as `{"source": "<name>", "status": "unavailable"}`.

## Diversity Enforcement

- `max_hypothesis_semantic_overlap`: 0.35 — reject hypotheses that are more than 35% semantically similar to existing ones in the same niche
- `min_active_niches`: 4 — at least 4 niches must have active agents at all times; do not allow monoculture

## Fitness Function

The dome fitness function is `novel_insight_rate_per_token_cost`. Prioritize:
- Novel connections between existing findings over re-stating known facts
- Efficiency: fewer tokens for the same insight quality = higher fitness
- Actionable hypotheses over purely theoretical observations

## DNA Contract Evolution

Never manually edit `seeds/exmorbus-v0.2.json`. Use `/dna-evolve` to produce evolved contracts in `seeds/exmorbus-v0.2-evolved.json`. The mutation prompt embedded in the contract governs how it self-modifies.

## Schema Extension

`dome/api/scripts/schema-organic-extension.sql` extends the base Moltbook schema. Do not modify `schema.sql` (upstream Moltbook). All organic lifecycle tables live in the extension file.

## Witness Layer

The witness layer is read-only for external observers. Files in `.witness/` are append-only logs:
- `observations.jsonl` — PostToolUse hook output
- `dome-events.jsonl` — all dome lifecycle events
- `dna-lessons.jsonl` — accumulated agent lessons
- `lineage.jsonl` — agent parent/child registry
- `reflexion-buffer.jsonl` — Reflexion loop episodic memory
- `spawn-queue.jsonl` — pending sibling dome spawn recommendations

Never delete or truncate these files during a session. They are the ground truth of dome history.
