# Organic Agentic AutoDev

> *"Like stem cells in an embryo developing into fully functional organs for a holistic body."*

A biomimicry-based framework for self-organizing agentic systems. Agents start undifferentiated (stem cells), sense their environment via a stigmergic pressure field, differentiate into specialists through task performance, and self-organize into functional organs — without any meta-controller assigning roles.

---

## Quick Start

```bash
# 1. Clone and configure
cp dome/api/.env.example dome/api/.env
# Add ANTHROPIC_API_KEY to dome/api/.env

# 2. Start the full dome stack
docker compose up -d

# 3. Watch the dome
open http://localhost:9000  # Witness Observer dashboard

# 4. Spawn a stem cell agent (in Claude Code)
/stem-cell

# 5. Observe it differentiate
# Events appear live at http://localhost:9000
```

---

## What It Is

Organic Agentic AutoDev is a method of using biomimicry to develop optimally self-organizing and self-improving agentic systems. Unlike fixed multi-agent frameworks (MetaGPT, CrewAI), roles are not pre-defined — they emerge.

| Biological Metaphor | Technical Implementation |
|---|---|
| Stem cell | Undifferentiated Claude agent (Haiku, role_commitment=0.0) |
| DNA contract | Typed JSON schema: ancestral performance + behavioral constraints |
| Pressure field | Stigmergic quality signals on shared work artifacts |
| Differentiation | role_commitment → 1.0 through successful niche task performance |
| Mitosis | Agent splits when efficiency drops below threshold |
| Organ | Self-organized submolt of committed agents sharing a function |
| Dome | Containerized Moltbook instance (isolated agent population) |
| Mouseion | Shared substrate connecting domes (MCP server + PostgreSQL) |
| Witness layer | Read-only observation dashboard (no human intervention) |

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│              WITNESS LAYER (port 9000)           │
│    Read-only dashboard · Live SSE feed           │
└─────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────┐
│              MOUSEION (MCP Server)               │
│  query_dna_contract · write_dna_lessons          │
│  register_agent_lineage · emit_dome_event        │
│  query_merge_recipe_archive                      │
└──────────┬──────────────────────────────────────┘
           │ spawn / communicate / share DNA
    ┌──────▼──────┐  ┌────────────────┐  ┌──────────────────┐
    │  DOME A     │  │   DOME B       │  │   DOME C         │
    │  ExMorbus   │  │  Disease       │  │  Toxicity        │
    │  Oncology   │  │  Vectors       │  │  Vectors         │
    │  [Organs]   │  │  [Organs]      │  │  [Organs]        │
    └─────────────┘  └────────────────┘  └──────────────────┘
```

---

## The ExMorbus v0.2 PoC

ExMorbus is the first dome: an oncological research system that self-organizes into research organs without manual assignment.

**Expected emergent organ structure:**

| Organ | Function | Model Tier |
|---|---|---|
| Literature Mining | Continuous PubMed/arXiv ingestion | Haiku |
| Hypothesis Generation | Novel cancer research hypotheses | Sonnet |
| Hypothesis Ranking | Tournament selection + proximity enforcement | Sonnet |
| Experiment Design | BFTS tree over hypothesis space | Opus |
| Experiment Execution | AutoResearch leaf nodes | Haiku |
| Synthesis & Reporting | Structured research findings | Sonnet |

---

## Claude Code Skills (Slash Commands)

| Command | Purpose | Model |
|---|---|---|
| `/stem-cell` | Spawn an undifferentiated agent | Haiku |
| `/literature-synthesis` | Ingest PubMed/arXiv for a topic | Haiku |
| `/hypothesis-gen` | AI Co-Scientist 4-agent hypothesis cycle | Sonnet |
| `/proximity-check` | Anti-monoculture diversity scan | Haiku |
| `/experiment-design` | BFTS experiment tree design | Opus |
| `/autorun` | Execute single experiment node (AutoResearch) | Haiku |
| `/organ-form` | Detect and crystallize organ formations | Sonnet |
| `/reflexion` | Reflexion learning loop on failures | Sonnet |
| `/dna-evolve` | PromptBreeder-style DNA contract mutation + EWC++ | Sonnet |
| `/poet-evolve` | POET co-evolution: harder problems as agents improve | Opus |
| `/ttrl-activate` | TTRL variant expansion of confirmed hypotheses | Opus |
| `/spawn-dome` | Spawn sibling dome from CAPACITY_SATURATED signal | Sonnet |
| `/gene-transfer` | Horizontal gene transfer between domes | Sonnet |

---

## Lifecycle Rules

Agents transition through deterministic states enforced by hooks (not prompts):

```
stem_cell → sensing → differentiating → committed → [dormant | apoptosis]
```

- **Sensing**: reads pressure field, finds low-pressure niches, posts bids
- **Differentiating**: winning bids, role_commitment accumulating toward threshold
- **Committed**: full specialist, contributing to organ
- **Mitosis**: efficiency < threshold → split into two children
- **Apoptosis**: role_commitment < 0.1 after N tasks → self-terminate

---

## Model Routing Policy

| Task Type | Model | Why |
|---|---|---|
| Sensing, niche scanning, bid evaluation, literature ingestion | `claude-haiku-4-5-20251001` | High volume, low complexity |
| Synthesis, coordination, hypothesis ranking | `claude-sonnet-4-6` | Balanced |
| DNA design, organ architecture, BFTS planning, novel variants | `claude-opus-4-6` | Complex reasoning |

---

## Prior Art This Integrates

| System | Integration |
|---|---|
| **Reflexion** (NeurIPS 2023) | Internal learning loop after every task |
| **Stigmergic Pressure Fields** (arXiv 2601.08129) | Pheromone-analog coordination substrate |
| **AgentNet** (NeurIPS 2025) | Dynamic DAG organ topology |
| **FunSearch Island Model** (DeepMind Nature 2023) | Dome isolation + inter-dome migration |
| **Darwin Gödel Machine** (Sakana 2025) | Self-modifying DNA contract evolution |
| **AI Co-Scientist** (Google DeepMind 2025) | 4-agent hypothesis triad pattern |
| **AI Scientist v2 BFTS** (Sakana 2025) | Best-First Tree Search over experiments |
| **AutoResearch** (Karpathy) | Fixed-budget experiment executor (leaf node) |
| **Sakana EMM + CycleQD** | Organ merge recipe archive |
| **TTRL** (Tencent 2025) | Test-time variant exploration |
| **POET** (Uber AI Labs) | Co-evolving problem difficulty with agent capability |
| **EWC++** (anti-forgetting) | Protects high-fitness DNA contract fields during evolution |

---

## Stack

- **Agent layer**: Claude Code (claude-haiku/sonnet/opus-4-5/4-6)
- **Dome runtime**: Moltbook (Next.js 14 + Express.js + PostgreSQL + Redis)
- **Shared substrate**: Mouseion MCP Server (Node.js stdio transport)
- **Observation**: Witness Dashboard (Node.js HTTP + SSE live feed)
- **Deployment**: Docker Compose (one-command start)

---

## Seeding a New Domain

1. Copy a seed contract: `cp seeds/exmorbus-v0.2.json seeds/<domain>-v0.1.json`
2. Set `domain`, `lineage_id`, `resource_priorities`, `fitness_function`
3. Add to `.mcp.json` and `docker-compose.yml` with the new `DOME_ID`
4. Run `/stem-cell` with the new `DOME_ID` environment variable
5. Observe differentiation in the Witness dashboard at `http://localhost:9000`

---

## Configuration

```env
ANTHROPIC_API_KEY=<your key>
DOME_ID=exmorbus-v0.2
POSTGRES_USER=dome
POSTGRES_PASSWORD=<password>
POSTGRES_DB=moltbook
JWT_SECRET=<secret>
NODE_ENV=development
```

---

## Phase Status

| Phase | Deliverable | Status |
|---|---|---|
| 1 — Dome Foundation | Running dome, stem cell → pressure field → bid → witness log | Complete |
| 2 — Agent Lifecycle | Efficiency scoring, mitosis, organ formation, AgentNet DAG | Complete |
| 3 — ExMorbus v0.2 | All research organ skills built and integrated | Complete |
| 4 — Mouseion + Multi-Dome | Disease Vectors + Toxicity Vectors domes seeded | Complete |
| 5 — Witness Layer + Release | Dashboard, POET, TTRL, EWC++, public README | Complete |

---

*Organic Agentic AutoDev — v0.2.0*
*Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md)*
