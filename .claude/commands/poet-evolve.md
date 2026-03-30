---
description: Run a POET co-evolution cycle — as agents improve, generate harder problems. Prevents stagnation by continuously raising the difficulty of the fitness landscape. Uses Opus for problem design.
argument-hint: <dome_id or leave blank for current dome>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-opus-4-6
---

# POET Co-Evolution Agent

You are running a **POET (Paired Open-Ended Trailblazers) co-evolution cycle**.

**Pattern:** POET (Uber AI Labs) — environments and agents co-evolve:
- When agents master current problems, generate harder ones
- New problems seed new agent populations with divergent traits
- Old agents transferred to new environments if fit
- Maintains novelty and prevents stagnation

**Application here:** ExMorbus generates increasingly complex oncology research tasks as agents become more capable.

**Model tier:** Opus (complex problem design)
**Target dome:** $ARGUMENTS (default: exmorbus-v0.2)

---

## Step 1 — Measure Current Agent Fitness

```bash
# Get current dome performance
curl -s "http://localhost:3001/api/v1/organs" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
for o in d.get('organs', []):
    print(f'Organ: {o[\"organ_function\"]} fitness={o[\"fitness_score\"]:.2f} members={o.get(\"member_count\",0)}')
" || echo "API unavailable"

# Load recent task performance from witness logs
cat .witness/dome-events.jsonl 2>/dev/null | python3 -c "
import sys, json
tasks = []
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        if e.get('event_type') == 'TASK_COMPLETED':
            tasks.append(e)
    except: pass
print(f'Total tasks completed: {len(tasks)}')
if tasks: print(f'Most recent: {tasks[-1].get(\"task_subject\", \"?\")}')
" || echo "No task data"
```

---

## Step 2 — Assess Fitness Plateau

Determine if agents have plateaued by checking:

1. **Task completion rate**: Are tasks being completed faster than they're being posted?
2. **Karma concentration**: Are top agents pulling significantly ahead of median?
3. **Hypothesis novelty decline**: Are recent hypotheses less novel than early ones?
4. **Organ saturation**: Are all expected organs fully formed and operating?

**Plateau threshold:**
- ≥ 3 organs at fitness > 0.75 = dome has mastered current difficulty
- ≥ 5 tasks completed per stem cell cycle = high throughput
- ≥ 10 lessons recorded = rich accumulated knowledge

If NOT plateaued: report current progress and recommended niche to reinforce.
If PLATEAUED: proceed to Step 3.

---

## Step 3 — Generate Harder Problems (POET Environment Evolution)

Load the current DNA contract:
```bash
cat seeds/exmorbus-v0.2.json
```

Design **3 harder problem variants** that:
1. Build on demonstrated agent capabilities
2. Require synthesis of multiple niches (vs. single-niche tasks)
3. Have stricter fitness criteria than current tasks
4. Push into less-explored territory

**Problem escalation strategies:**

| Current Capability | Next Level Challenge |
|---|---|
| Single gene analysis | Multi-gene network interaction analysis |
| Known pathway analysis | Novel pathway hypothesis generation |
| Literature synthesis | Gap identification in literature + novel connection |
| In-silico experiment design | Cross-species validation experiment design |
| Single cancer type | Pan-cancer comparative analysis |

For each harder problem, produce a task specification:

```json
{
  "task_type": "<harder_type>",
  "niche_id": "<niche>",
  "description": "<harder problem description>",
  "required_output_schema": {
    "finding_type": "required",
    "hypothesis": "required",
    "cross_niche_connections": "required",
    "validation_strategy": "required",
    "novelty_claim": "required",
    "confidence_bounds": "required"
  },
  "resource_budget": {"tokens": 8000, "model": "sonnet"},
  "fitness_impact_estimate": 0.9,
  "poet_difficulty_level": 2,
  "unlocks_at_fitness": 0.75
}
```

---

## Step 4 — Evolve the Fitness Function

If the dome has consistently exceeded current fitness expectations, propose an evolution of the `fitness_function` itself:

Current: `novel_insight_rate_per_token_cost`

Consider escalating to:
- `cross_validated_novel_insight_rate_per_token_cost` (requires multiple organ confirmation)
- `actionable_testable_insight_rate_per_token_cost` (requires experiment design as output)
- `novel_multi_pathway_insight_rate` (requires cross-niche synthesis)

Produce a DNA contract patch:
```json
{
  "fitness_function": "<new function>",
  "fitness_evaluation_criteria": {
    "novelty": "<harder criterion>",
    "plausibility": "<harder criterion>",
    "actionability": "<harder criterion>",
    "specificity": "<harder criterion>",
    "cross_validation": "Confirmed by at least 2 independent organ outputs"
  },
  "poet_generation": 2
}
```

---

## Step 5 — Check Agent Transfer Eligibility

For each committed agent, assess if they can handle the new harder environment:
- Agents with `efficiency_score > 0.7` → eligible for harder tasks
- Agents with `efficiency_score < 0.4` → recommend apoptosis (they won't survive harder env)
- Median agents → continue in current environment while harder env seeds

---

## Step 6 — Output

```json
{
  "agent_role": "poet_evolution",
  "dome_id": "exmorbus-v0.2",
  "finding_type": "difficulty_escalation",
  "hypothesis": "Agent capability has saturated current problem difficulty — harder problems will drive continued improvement",
  "fitness_plateau_detected": false,
  "new_tasks_generated": [],
  "fitness_function_mutation": null,
  "transfer_eligible_agents": [],
  "evidence": [],
  "novelty_claim": "Open-ended co-evolution: problem difficulty tracks agent capability",
  "actionability": "<post new tasks to task board and run /dna-evolve to apply fitness function mutation>",
  "resource_cost_estimate": {"tokens_used": 0, "model": "opus"}
}
```

---

## Step 7 — Write + Emit

Save harder tasks:
```bash
# Post harder tasks via API
curl -s -X POST http://localhost:3001/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '<task_json>' 2>/dev/null || echo "Post tasks manually"
```

Write POET lesson:
- Tool: `mcp__mouseion__write_dna_lessons`
- `lesson_type`: "insight"
- `lesson`: what capability plateau was detected and what harder problems were generated

Apply fitness function mutation:
- Run `/dna-evolve` with the proposed patch if plateau confirmed
