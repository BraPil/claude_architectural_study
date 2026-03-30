---
description: Execute a single experiment node — the AutoResearch leaf node. Fixed time budget, single metric, one data source query, one file mutation. Uses Haiku for cost efficiency.
argument-hint: <experiment_node JSON or node_id>
context: fork
allowed-tools: Read, Write, Bash, WebFetch, Glob
model: claude-haiku-4-5-20251001
---

# AutoResearch Leaf Node — Experiment Executor

You are executing a **single experiment node** in the BFTS experiment tree.

This implements **Karpathy's AutoResearch** principle:
- Fixed time budget (don't overrun)
- Single success metric (one thing to confirm or deny)
- One file mutation per run (record exactly what you found)
- No scope creep — exit when budget is reached

**Model tier:** Haiku (speed + cost over depth)
**Input node:** $ARGUMENTS

---

## Constraints (HARD LIMITS — do not exceed)

- Max tokens this session: as specified in node `resource_budget.max_tokens` (default 4000)
- Max API calls to external sources: `resource_budget.max_api_calls` (default 5)
- Max runtime: `resource_budget.max_time_seconds` (default 120s)
- Exactly ONE finding recorded — stop after first clear result

---

## Step 1 — Parse Experiment Node

If $ARGUMENTS is a node ID, look it up:
```bash
cat .witness/dome-events.jsonl 2>/dev/null | python3 -c "
import sys, json
node_id = '$ARGUMENTS'
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        if e.get('event_type') == 'EXPERIMENT_DESIGNED':
            for node in e.get('payload', {}).get('experiment_nodes', []):
                if node.get('node_id') == node_id:
                    print(json.dumps(node, indent=2))
    except: pass
" || echo "Node not found in logs — check if provided as JSON"
```

Extract:
- `experiment_type`
- `protocol.data_source`
- `protocol.query_strategy`
- `protocol.success_metric`
- `protocol.failure_criterion`
- `resource_budget`

---

## Step 2 — Execute Experiment

Execute based on `experiment_type`:

### `literature_gap_analysis`
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<protocol.query_strategy>&retmax=5&format=json
```
Then fetch abstracts for each result ID. Look for papers that directly contradict or support the hypothesis.

### `pathway_enrichment_simulation`
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<gene>+pathway+cancer&retmax=3&format=json
```
For each gene in hypothesis, find pathway enrichment evidence. Report KEGG/Reactome pathway IDs mentioned.

### `drug_target_interaction`
```
GET https://go.drugbank.com/drugs/search?q=<compound>&format=json
```
If DrugBank not available: search PubMed for `<compound> <target gene> interaction cancer`.

### `survival_correlation`
Search TCGA-related publications:
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=TCGA+<gene>+survival+cancer&retmax=3&format=json
```

---

## Step 3 — Evaluate Against Success Metric

Compare your finding to `protocol.success_metric` and `protocol.failure_criterion`.

**Result must be one of:**
- `CONFIRMED`: finding clearly supports the sub-question
- `REFUTED`: finding clearly contradicts the sub-question
- `INCONCLUSIVE`: insufficient evidence either way
- `BLOCKED`: data source unavailable, budget exceeded

---

## Step 4 — Record Finding (ONE FILE MUTATION)

Write exactly one result file to `.witness/experiments/`:

```bash
mkdir -p .witness/experiments
cat > .witness/experiments/<node_id>.json << 'EOF'
{
  "node_id": "<id>",
  "executed_at": "<ISO timestamp>",
  "result": "CONFIRMED|REFUTED|INCONCLUSIVE|BLOCKED",
  "finding": "<one paragraph — what was found>",
  "evidence_items": [
    {"source": "<url or pmid>", "excerpt": "<relevant quote or finding>", "supports_hypothesis": true}
  ],
  "tokens_used": 0,
  "api_calls_made": 0,
  "success_metric_met": true,
  "parent_hypothesis_update": "<one sentence updating the hypothesis confidence>"
}
EOF
```

---

## Step 5 — Structured Output

```json
{
  "agent_role": "autorun_executor",
  "node_id": "<id>",
  "finding_type": "experiment_result",
  "hypothesis": "<the sub-question being tested>",
  "result": "CONFIRMED|REFUTED|INCONCLUSIVE|BLOCKED",
  "evidence": [
    {"source": "<id>", "claim": "<what was found>", "confidence": "high|medium|low"}
  ],
  "novelty_claim": "<if confirmed, what does this newly establish>",
  "actionability": "<next experiment to run in the BFTS tree>",
  "resource_cost_estimate": {"tokens_used": 0, "api_calls": 0, "model": "haiku"},
  "budget_remaining": {"tokens": 0, "api_calls": 0}
}
```

---

## Step 6 — Update BFTS Tree

Emit task completion:
- Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "TASK_COMPLETED"
- `payload`: `{"node_id": "...", "result": "...", "next_node_recommendation": "..."}`

Write lesson:
- Tool: `mcp__mouseion__write_dna_lessons`
- `lesson_type`: "success" or "failure"
- `lesson`: what this experiment type revealed about hypothesis testability

**Then STOP. Do not start another experiment. Budget is fixed per node.**
