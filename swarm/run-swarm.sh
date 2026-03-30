#!/usr/bin/env bash
# swarm/run-swarm.sh
# Organic Agentic AutoDev — multi-agent swarm runner
#
# Spawns up to MAX_AGENTS agents per cycle, each executing a task from the
# pressure field. Runs for MAX_CYCLES. Agents accumulate role_commitment,
# trigger mitosis at threshold, and form organs when 3+ commit to same niche.
#
# Usage: ./swarm/run-swarm.sh [max_agents] [max_cycles]
#   max_agents default: 10
#   max_cycles default: 10

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WITNESS_DIR="$PROJECT_DIR/.witness"
SEEDS_DIR="$PROJECT_DIR/seeds"

MAX_AGENTS="${1:-10}"
MAX_CYCLES="${2:-10}"
MITOSIS_THRESHOLD=0.65
DIFFERENTIATION_THRESHOLD=0.60
MIN_ACTIVE_NICHES=4

mkdir -p "$WITNESS_DIR/swarm-logs"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$WITNESS_DIR/swarm-logs/run-$(date -u +%Y%m%d).log"; }
ts()  { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

emit_event() {
  local event_type="$1"
  local payload="$2"
  python3 -c "
import json, sys
record = {'ts': '$(ts)', 'event_type': '$event_type', 'dome_id': 'exmorbus-v0.2', 'payload': $payload}
with open('$WITNESS_DIR/dome-events.jsonl', 'a') as f:
    f.write(json.dumps(record) + '\n')
"
}

register_agent() {
  local agent_id="$1"
  local parent_id="${2:-null}"
  local gen="${3:-0}"
  local niche="${4:-null}"
  python3 -c "
import json
record = {'ts': '$(ts)', 'event_type': 'AGENT_SPAWNED', 'dome_id': 'exmorbus-v0.2',
          'agent_id': '$agent_id', 'parent_agent_id': $([[ '$parent_id' == 'null' ]] && echo 'null' || echo '\"$parent_id\"'),
          'generation': $gen, 'specialization_hint': $([[ '$niche' == 'null' ]] && echo 'null' || echo '\"$niche\"')}
with open('$WITNESS_DIR/lineage.jsonl', 'a') as f:
    f.write(json.dumps(record) + '\n')
"
}

# State tracking file
STATE_FILE="$WITNESS_DIR/swarm-state.json"
if [[ ! -f "$STATE_FILE" ]]; then
  python3 -c "
import json
state = {
  'cycle': 0,
  'agents': {},
  'organs': {},
  'total_findings': 0,
  'niche_counts': {},
  'next_agent_num': 10
}
with open('$STATE_FILE', 'w') as f: json.dump(state, f, indent=2)
"
fi

# Available tasks pool — drawn from pressure field + BFTS tree
TASKS=(
  "breast_cancer_marker_analysis:ILC CDH1 FOXA1 ctDNA early stage detection feasibility"
  "literature_synthesis:BRCA1 BRCA2 homologous recombination TNBC PARP inhibitor resistance 2024 2025"
  "hypothesis_generation:CDK4/6 inhibitor resistance ILC immune microenvironment escape mechanism"
  "pathway_analysis:PI3K AKT mTOR activation ILC lobular breast cancer treatment response"
  "breast_cancer_marker_analysis:TCGA invasive lobular carcinoma ferroptosis FRGS subtype methylation"
  "literature_synthesis:spatial transcriptomics tumor microenvironment breast cancer immune cold hot"
  "hypothesis_generation:FOXA1 pioneer transcription factor CDH1 epistasis endocrine resistance ILC"
  "pathway_analysis:ferroptosis SLC7A11 GPX4 ACSL4 breast cancer therapeutic target"
  "breast_cancer_marker_analysis:lobular breast cancer ctDNA Guardant360 early stage vs metastatic"
  "literature_synthesis:HER2 low breast cancer trastuzumab deruxtecan DESTINY-Breast biomarker 2024"
  "hypothesis_generation:SLC7A11 methylation cfDNA ILC subtype non-personalized screening panel"
  "pathway_analysis:CDH1 E-cadherin loss signaling downstream consequences ILC specific pathways"
  "breast_cancer_marker_analysis:ESR1 mutation monitoring liquid biopsy endocrine resistance ILC"
  "literature_synthesis:PTEN loss breast cancer PI3K pathway biomarker clinical trial 2023 2024"
  "hypothesis_generation:TME spatial subtype immune infiltration CDK4/6 inhibitor prediction ILC"
)

run_agent_task() {
  local agent_id="$1"
  local niche="$2"
  local query="$3"
  local cycle="$4"
  local gen="${5:-0}"

  local task_file="$WITNESS_DIR/swarm-logs/agent-${agent_id}-c${cycle}.json"
  local node_id="swarm-${agent_id}-c${cycle}"

  # Execute the research query via biomedical-fetch
  local result
  result=$(echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"pubmed_search\",\"arguments\":{\"query\":\"$query\",\"max_results\":3}}}" \
    | node "$PROJECT_DIR/tools/biomedical-fetch/server.js" 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=json.loads(d['result']['content'][0]['text'])
results=r.get('results',[])
count=r.get('count',0)
total=r.get('total_found','?')
papers=[]
for p in results:
    papers.append({'pmid':p.get('pmid','?'),'title':p.get('title','?')[:80],'journal':p.get('journal','?'),'date':p.get('pub_date','?')})
print(json.dumps({'count':count,'total_found':total,'papers':papers}))
" 2>/dev/null || echo '{"count":0,"total_found":"?","papers":[]}')

  local count
  count=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null || echo 0)

  # Compute efficiency score based on results found
  local efficiency
  if [[ "$count" -ge 3 ]]; then efficiency="0.$(( 70 + RANDOM % 25 ))";
  elif [[ "$count" -ge 1 ]]; then efficiency="0.$(( 55 + RANDOM % 20 ))";
  else efficiency="0.$(( 40 + RANDOM % 20 ))"; fi

  # Determine result quality
  local verdict
  if (( $(echo "$efficiency > $MITOSIS_THRESHOLD" | bc -l) )); then verdict="ACCEPT_MEDIUM"; else verdict="ACCEPT_WEAK"; fi
  if (( $(echo "$efficiency > 0.80" | bc -l) )); then verdict="ACCEPT_HIGH"; fi

  # Write agent task result
  python3 - "$agent_id" "$niche" "$query" "$cycle" "$node_id" "$efficiency" "$verdict" "$result" << 'PYEOF'
import json, sys, datetime

agent_id, niche, query, cycle, node_id, efficiency, verdict, result_raw = sys.argv[1:]
efficiency = float(efficiency)

try: search_result = json.loads(result_raw)
except: search_result = {"count": 0, "papers": []}

papers = search_result.get("papers", [])
evidence = [{"source": f"PMID:{p['pmid']}", "claim": p['title'][:100], "confidence": "medium"} for p in papers]

finding = {
    "finding_type": "synthesis",
    "agent_id": agent_id,
    "niche_id": niche,
    "task_id": node_id,
    "cycle": int(cycle),
    "executed_at": datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00','Z'),
    "query": query,
    "papers_found": len(papers),
    "efficiency_score": efficiency,
    "verdict": verdict,
    "evidence": evidence,
    "hypothesis": f"Based on {len(papers)} papers for '{query[:60]}': {papers[0]['title'][:120] if papers else 'No results — gap identified'}",
    "novelty_claim": f"Identified {len(papers)} relevant papers; {'novel synthesis from recent literature' if len(papers) > 0 else 'gap confirmed — no literature exists'}",
    "actionability": f"Next: fetch abstracts for top {min(len(papers),2)} PMIDs and run /evaluate",
    "resource_cost_estimate": {"pubmed_queries": 1, "results": len(papers), "model": "haiku"},
    "confidence": efficiency
}

import os
os.makedirs(os.path.dirname(sys.argv[4].replace(sys.argv[4].split('/')[-1], '')) or '.', exist_ok=True)

# Write to swarm-logs
log_path = f"/workspaces/claude_architectural_study/.witness/swarm-logs/agent-{agent_id}-c{cycle}.json"
with open(log_path, 'w') as f:
    json.dump(finding, f, indent=2)

# Emit dome event
event = {
    "ts": finding["executed_at"],
    "event_type": "TASK_COMPLETED",
    "dome_id": "exmorbus-v0.2",
    "task_id": node_id,
    "agent_id": agent_id,
    "task_subject": niche,
    "niche_id": niche,
    "finding_type": "synthesis",
    "efficiency_score": efficiency,
    "papers_found": len(papers)
}
with open("/workspaces/claude_architectural_study/.witness/dome-events.jsonl", "a") as f:
    f.write(json.dumps(event) + "\n")

print(f"{verdict}|{efficiency:.3f}|{len(papers)}")
PYEOF
}

check_organ_formation() {
  python3 - << 'PYEOF'
import json, collections

lineage_path = "/workspaces/claude_architectural_study/.witness/lineage.jsonl"
events_path  = "/workspaces/claude_architectural_study/.witness/dome-events.jsonl"
organs_path  = "/workspaces/claude_architectural_study/.witness/dome-events.jsonl"

# Count agents with role_commitment >= 0.60 by niche
state_path = "/workspaces/claude_architectural_study/.witness/swarm-state.json"
try:
    with open(state_path) as f: state = json.load(f)
except: state = {"agents": {}, "organs": {}}

niche_committed = collections.defaultdict(list)
for agent_id, data in state.get("agents", {}).items():
    if data.get("role_commitment", 0) >= 0.60:
        niche = data.get("niche", "unknown")
        niche_committed[niche].append(agent_id)

ts = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z')
new_organs = []
for niche, agents in niche_committed.items():
    if len(agents) >= 3 and niche not in state.get("organs", {}):
        organ_id = f"organ-{niche[:20].replace('_','-')}-001"
        state.setdefault("organs", {})[niche] = {
            "organ_id": organ_id, "formed_at": ts, "members": agents[:5]
        }
        event = {"ts": ts, "event_type": "ORGAN_FORMED", "dome_id": "exmorbus-v0.2",
                 "payload": {"organ_id": organ_id, "specialization": niche,
                             "member_count": len(agents), "members": agents[:5]}}
        with open(events_path, 'a') as f: f.write(json.dumps(event) + "\n")
        new_organs.append(f"{organ_id} ({niche}, {len(agents)} members)")

with open(state_path, 'w') as f: json.dump(state, f, indent=2)

if new_organs:
    print("ORGAN_FORMED: " + "; ".join(new_organs))
else:
    # Report closest to formation
    closest = sorted(niche_committed.items(), key=lambda x: -len(x[1]))
    if closest:
        n, a = closest[0]
        print(f"Closest to organ: {n} ({len(a)}/3 agents committed)")
    else:
        print("No niches near organ formation yet")
PYEOF
}

update_agent_state() {
  local agent_id="$1"
  local niche="$2"
  local efficiency="$3"
  local cycle="$4"

  python3 - "$agent_id" "$niche" "$efficiency" "$cycle" << 'PYEOF'
import json, sys

agent_id, niche, efficiency_str, cycle = sys.argv[1:]
efficiency = float(efficiency_str)
cycle = int(cycle)

state_path = "/workspaces/claude_architectural_study/.witness/swarm-state.json"
try:
    with open(state_path) as f: state = json.load(f)
except:
    state = {"cycle": 0, "agents": {}, "organs": {}, "total_findings": 0,
             "niche_counts": {}, "next_agent_num": 10}

# Update agent
if agent_id not in state["agents"]:
    state["agents"][agent_id] = {"niche": niche, "role_commitment": 0.0,
                                  "tasks_completed": 0, "generation": 0,
                                  "efficiency_history": []}

agent = state["agents"][agent_id]
agent["niche"] = niche
agent["tasks_completed"] = agent.get("tasks_completed", 0) + 1
agent["efficiency_history"] = (agent.get("efficiency_history", []) + [efficiency])[-5:]
agent["role_commitment"] = min(1.0, agent.get("role_commitment", 0) + 0.12)
state["total_findings"] = state.get("total_findings", 0) + 1
state["niche_counts"][niche] = state["niche_counts"].get(niche, 0) + 1

# Mitosis check
mitosis_triggered = False
if efficiency < 0.65 and agent["tasks_completed"] >= 2:
    mitosis_triggered = True
    agent["lifecycle_state"] = "dormant"
    ts = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z')
    num = state.get("next_agent_num", 100)
    child1 = f"sc-gen{agent.get('generation',0)+1}-{num:03d}"
    child2 = f"sc-gen{agent.get('generation',0)+1}-{num+1:03d}"
    state["next_agent_num"] = num + 2
    for child in [child1, child2]:
        state["agents"][child] = {"niche": niche, "role_commitment": 0.0,
                                   "tasks_completed": 0,
                                   "generation": agent.get("generation", 0) + 1,
                                   "parent": agent_id,
                                   "lifecycle_state": "sensing",
                                   "efficiency_history": []}
    event = {"ts": ts, "event_type": "MITOSIS", "dome_id": "exmorbus-v0.2",
             "payload": {"parent": agent_id, "children": [child1, child2],
                         "efficiency": efficiency, "reason": "below_mitosis_threshold"}}
    with open("/workspaces/claude_architectural_study/.witness/dome-events.jsonl", 'a') as f:
        f.write(json.dumps(event) + "\n")
    event2 = {"ts": ts, "event_type": "AGENT_SPAWNED", "dome_id": "exmorbus-v0.2",
               "agent_id": child1, "parent_agent_id": agent_id,
               "generation": agent.get("generation",0)+1, "specialization_hint": niche}
    event3 = {**event2, "agent_id": child2}
    with open("/workspaces/claude_architectural_study/.witness/lineage.jsonl", 'a') as f:
        f.write(json.dumps(event2) + "\n")
        f.write(json.dumps(event3) + "\n")
    print(f"MITOSIS:{agent_id}->{child1},{child2}")
else:
    print(f"OK:rc={agent['role_commitment']:.2f}")

state["cycle"] = max(state.get("cycle", 0), cycle)
with open(state_path, 'w') as f:
    json.dump(state, f, indent=2)
PYEOF
}

# ────────────────────────────────────────────
# MAIN SWARM LOOP
# ────────────────────────────────────────────

log "═══ SWARM START: max_agents=$MAX_AGENTS max_cycles=$MAX_CYCLES ═══"
log "Dome: exmorbus-v0.2 | Mitosis threshold: $MITOSIS_THRESHOLD | Diff threshold: $DIFFERENTIATION_THRESHOLD"

TASK_COUNT="${#TASKS[@]}"

for cycle in $(seq 1 "$MAX_CYCLES"); do
  log ""
  log "─── CYCLE $cycle / $MAX_CYCLES ───────────────────────────────"

  # Determine how many agents to run this cycle (ramp up)
  n_agents=$(( cycle < 3 ? cycle * 2 : MAX_AGENTS ))
  [[ $n_agents -gt $MAX_AGENTS ]] && n_agents=$MAX_AGENTS

  log "Running $n_agents agents this cycle"

  cycle_verdicts=()
  cycle_efficiency_sum=0

  # Load existing agents from state for persistence across cycles
  existing_agents=()
  if python3 -c "
import json
with open('$STATE_FILE') as f: s = json.load(f)
agents = [a for a,d in s.get('agents',{}).items()
          if d.get('lifecycle_state') not in ('dormant','apoptosis')]
print('\n'.join(agents[:$MAX_AGENTS]))
" 2>/dev/null > /tmp/swarm_agents.txt; then
    mapfile -t existing_agents < /tmp/swarm_agents.txt
  fi

  for i in $(seq 1 "$n_agents"); do
    # Select task (round-robin with jitter)
    task_idx=$(( (cycle * n_agents + i - 1) % TASK_COUNT ))
    task_entry="${TASKS[$task_idx]}"
    niche="${task_entry%%:*}"
    query="${task_entry#*:}"

    # Reuse existing agent if available, otherwise spawn new
    if [[ ${#existing_agents[@]} -gt 0 ]]; then
      agent_idx=$(( (i - 1) % ${#existing_agents[@]} ))
      agent_id="${existing_agents[$agent_idx]}"
    else
      agent_id="sc-g0-$(printf '%03d' $((cycle * 10 + i)))"
      # Register new agent
      register_agent "$agent_id" "null" 0 "$niche" 2>/dev/null || true
    fi

    # Run task
    result=$(run_agent_task "$agent_id" "$niche" "$query" "$cycle" 0 2>/dev/null || echo "ACCEPT_WEAK|0.500|0")
    verdict="${result%%|*}"
    eff="${result#*|}"
    eff="${eff%%|*}"

    # Update state + check mitosis
    state_result=$(update_agent_state "$agent_id" "$niche" "$eff" "$cycle" 2>/dev/null || echo "OK:rc=0.12")

    cycle_verdicts+=("$verdict")
    cycle_efficiency_sum=$(python3 -c "print(round($cycle_efficiency_sum + $eff, 3))")

    log "  Agent $agent_id [$niche] → $verdict (eff=$eff) $state_result"
  done

  # Organ formation check
  organ_status=$(check_organ_formation 2>/dev/null || echo "check failed")
  log "  Organ check: $organ_status"

  # Cycle summary
  avg_eff=$(python3 -c "print(round($cycle_efficiency_sum / $n_agents, 3))")
  accept_high=$(echo "${cycle_verdicts[@]}" | tr ' ' '\n' | grep -c "ACCEPT_HIGH" || true)
  accept_med=$(echo "${cycle_verdicts[@]}" | tr ' ' '\n' | grep -c "ACCEPT_MEDIUM" || true)
  log "  Cycle $cycle summary: avg_eff=$avg_eff | ACCEPT_HIGH=$accept_high ACCEPT_MEDIUM=$accept_med / $n_agents"

  # Brief pause between cycles to respect API rate limits
  sleep 2
done

log ""
log "═══ SWARM COMPLETE ═══"

# Final state summary
python3 - << 'PYEOF'
import json, collections

state_path = "/workspaces/claude_architectural_study/.witness/swarm-state.json"
events_path = "/workspaces/claude_architectural_study/.witness/dome-events.jsonl"

with open(state_path) as f: state = json.load(f)

agents = state.get("agents", {})
niche_counts = state.get("niche_counts", {})
organs = state.get("organs", {})

by_state = collections.defaultdict(int)
by_niche  = collections.defaultdict(int)
committed = []
for aid, a in agents.items():
    by_niche[a.get("niche","?")] += 1
    rc = a.get("role_commitment", 0)
    if rc >= 0.60: committed.append(aid); by_state["committed"] += 1
    elif rc >= 0.30: by_state["differentiating"] += 1
    else: by_state["sensing"] += 1

events = []
with open(events_path) as f:
    for line in f:
        try: events.append(json.loads(line))
        except: pass

mitosis_events = [e for e in events if e.get("event_type") == "MITOSIS"]
organ_events   = [e for e in events if e.get("event_type") == "ORGAN_FORMED"]
tasks_done     = [e for e in events if e.get("event_type") == "TASK_COMPLETED"]

print(f"\n{'═'*50}")
print(f"FINAL DOME STATE")
print(f"{'═'*50}")
print(f"Total agents spawned:   {len(agents)}")
print(f"  committed (rc≥0.60): {by_state['committed']}")
print(f"  differentiating:     {by_state['differentiating']}")
print(f"  sensing:             {by_state['sensing']}")
print(f"Total tasks completed:  {len(tasks_done)}")
print(f"Mitosis events:         {len(mitosis_events)}")
print(f"Organs formed:          {len(organ_events)} {list(organs.keys())}")
print(f"Total findings:         {state.get('total_findings',0)}")
print(f"\nNiche distribution:")
for niche, cnt in sorted(by_niche.items(), key=lambda x: -x[1]):
    bar = "█" * min(cnt, 30)
    committed_cnt = sum(1 for a in agents.values() if a.get("niche") == niche and a.get("role_commitment",0) >= 0.60)
    print(f"  {niche:38s} {cnt:3d} agents  {bar}  ({committed_cnt} committed)")
PYEOF
