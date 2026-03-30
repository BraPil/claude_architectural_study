#!/usr/bin/env node
/**
 * Mouseion MCP Server
 * Exposes the Organic Agentic AutoDev shared substrate as MCP tools.
 *
 * Tools (5 max per CCA Domain 2 best practice):
 *   1. query_dna_contract      — fetch DNA contract by lineage_id
 *   2. write_dna_lessons       — append lessons to DNA contract ancestor_performance
 *   3. register_agent_lineage  — record parent/child agent relationship
 *   4. emit_dome_event         — emit a typed dome event to the event log
 *   5. query_merge_recipe_archive — find organ merge recipes by domain/function
 *
 * Transport: stdio (Claude Code MCP standard)
 * Config: .mcp.json in project root
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || join(__dirname, "..");
const WITNESS_DIR = join(PROJECT_DIR, ".witness");
const SEEDS_DIR = join(PROJECT_DIR, "seeds");

// Ensure witness dir exists
if (!existsSync(WITNESS_DIR)) mkdirSync(WITNESS_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────
// MCP Protocol helpers (stdio transport)
// ─────────────────────────────────────────────────────────

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

// ─────────────────────────────────────────────────────────
// Tool implementations
// ─────────────────────────────────────────────────────────

/**
 * query_dna_contract
 * Fetches the DNA contract JSON for a given lineage_id.
 * Falls back to reading from seeds/ directory (Phase 1: no DB required).
 */
function queryDnaContract({ lineage_id }) {
  if (!lineage_id) return { error: "lineage_id is required" };

  // Try exact filename match first (e.g. seeds/exmorbus-oncology-v2.json)
  const seedFile = join(SEEDS_DIR, `${lineage_id}.json`);
  if (existsSync(seedFile)) {
    try {
      const contract = JSON.parse(readFileSync(seedFile, "utf8"));
      return { contract, source: "seeds" };
    } catch (e) {
      return { error: `Failed to parse contract: ${e.message}` };
    }
  }

  // Scan all JSON files in seeds/ for a contract with matching lineage_id
  try {
    const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const contract = JSON.parse(readFileSync(join(SEEDS_DIR, file), "utf8"));
        if (contract.lineage_id === lineage_id) {
          return { contract, source: "seeds", file };
        }
      } catch { /* skip unparseable files */ }
    }
  } catch { /* seeds dir scan failed */ }

  return { error: `No contract found for lineage_id: ${lineage_id}` };
}

/**
 * write_dna_lessons
 * Appends a lesson to the dome events log and returns it for contract evolution.
 * In Phase 1 this writes to .witness/dna-lessons.jsonl.
 * Phase 4+ will write to the Mouseion PostgreSQL store.
 */
function writeDnaLessons({ lineage_id, lesson_type, lesson, evidence, niche_id }) {
  if (!lineage_id || !lesson) return { error: "lineage_id and lesson are required" };

  const record = {
    ts: new Date().toISOString(),
    lineage_id,
    lesson_type: lesson_type || "general",
    niche_id: niche_id || null,
    lesson,
    evidence: evidence || [],
  };

  const logFile = join(WITNESS_DIR, "dna-lessons.jsonl");
  appendFileSync(logFile, JSON.stringify(record) + "\n");

  return {
    written: true,
    record,
    note: "Lesson logged. Run /dna-evolve to apply lessons to next contract version.",
  };
}

/**
 * register_agent_lineage
 * Records a parent/child agent relationship in the lineage log.
 */
function registerAgentLineage({ agent_id, parent_agent_id, dome_id, generation, specialization_hint }) {
  if (!agent_id) return { error: "agent_id is required" };

  const record = {
    ts: new Date().toISOString(),
    event_type: "AGENT_SPAWNED",
    dome_id: dome_id || process.env.DOME_ID || "exmorbus-v0.2",
    agent_id,
    parent_agent_id: parent_agent_id || null,
    generation: generation || 0,
    specialization_hint: specialization_hint || null,
  };

  const logFile = join(WITNESS_DIR, "lineage.jsonl");
  appendFileSync(logFile, JSON.stringify(record) + "\n");

  return { registered: true, record };
}

/**
 * emit_dome_event
 * Emits a typed dome event to the event log.
 * Used for inter-dome communication signals (CAPACITY_SATURATED, etc.)
 */
function emitDomeEvent({ event_type, source_dome_id, target_dome_id, payload }) {
  const validTypes = [
    "AGENT_SPAWNED", "AGENT_DIFFERENTIATED", "MITOSIS", "APOPTOSIS",
    "ORGAN_FORMED", "ORGAN_SATURATED", "CAPACITY_SATURATED",
    "TASK_POSTED", "TASK_COMPLETED", "BID_ACCEPTED",
    "HORIZONTAL_GENE_TRANSFER", "SPAWN_REQUEST", "KNOWLEDGE_TRANSFER",
  ];

  if (!event_type) return { error: "event_type is required" };
  if (!validTypes.includes(event_type)) {
    return { error: `Unknown event_type: ${event_type}. Valid: ${validTypes.join(", ")}` };
  }

  const record = {
    ts: new Date().toISOString(),
    event_type,
    source_dome_id: source_dome_id || process.env.DOME_ID || "exmorbus-v0.2",
    target_dome_id: target_dome_id || null,
    payload: payload || {},
  };

  const logFile = join(WITNESS_DIR, "dome-events.jsonl");
  appendFileSync(logFile, JSON.stringify(record) + "\n");

  // CAPACITY_SATURATED — log spawn recommendation
  if (event_type === "CAPACITY_SATURATED" && payload?.suggested_sibling_domain) {
    const spawnRec = {
      ts: new Date().toISOString(),
      event_type: "SPAWN_RECOMMENDATION",
      suggested_domain: payload.suggested_sibling_domain,
      triggering_dome: source_dome_id,
      status: "pending_human_review",
    };
    appendFileSync(join(WITNESS_DIR, "spawn-queue.jsonl"), JSON.stringify(spawnRec) + "\n");
  }

  return { emitted: true, record };
}

/**
 * query_merge_recipe_archive
 * Returns available organ merge recipes for a given domain/function.
 * Phase 1: returns empty archive with schema.
 * Phase 4+: queries Mouseion PostgreSQL.
 */
function queryMergeRecipeArchive({ domain, organ_function }) {
  // Phase 1 stub — returns schema for what recipes will look like
  return {
    domain: domain || "any",
    organ_function: organ_function || "any",
    recipes: [],
    note: "Merge recipe archive is empty in Phase 1. Recipes will be populated as organs form and are validated in Phase 3+.",
    schema: {
      id: "uuid",
      domain: "string",
      organ_function: "string",
      base_models: ["model_id_1", "model_id_2"],
      merge_coefficients: { model_id_1: 0.6, model_id_2: 0.4 },
      capability_profile: { literature_synthesis: 0.9, hypothesis_generation: 0.7 },
      fitness_score: 0.0,
      validated: false,
    },
  };
}

// ─────────────────────────────────────────────────────────
// MCP tool registry
// ─────────────────────────────────────────────────────────

const TOOLS = {
  query_dna_contract: {
    description:
      "Fetch the DNA contract for a dome by lineage_id. Returns the full typed contract including ancestor_performance, thresholds, fitness function, and forbidden actions. Call this first when a new agent spawns.",
    inputSchema: {
      type: "object",
      required: ["lineage_id"],
      properties: {
        lineage_id: { type: "string", description: "e.g. 'exmorbus-oncology-v2'" },
      },
    },
    fn: queryDnaContract,
  },
  write_dna_lessons: {
    description:
      "Append a lesson learned to the DNA contract store. Use after completing or failing a task to record what worked, what failed, and why. These lessons will be incorporated into the next DNA contract generation via /dna-evolve.",
    inputSchema: {
      type: "object",
      required: ["lineage_id", "lesson"],
      properties: {
        lineage_id: { type: "string" },
        lesson_type: { type: "string", enum: ["success", "failure", "insight", "general"] },
        niche_id: { type: "string", description: "Which niche/specialization this lesson applies to" },
        lesson: { type: "string", description: "The distilled lesson (1-3 sentences)" },
        evidence: { type: "array", items: { type: "string" }, description: "Supporting evidence or observations" },
      },
    },
    fn: writeDnaLessons,
  },
  register_agent_lineage: {
    description:
      "Record a new agent in the lineage registry. Call this immediately after spawning a new agent (stem cell or mitosis child). Tracks parent/child relationships across generations.",
    inputSchema: {
      type: "object",
      required: ["agent_id"],
      properties: {
        agent_id: { type: "string" },
        parent_agent_id: { type: "string", description: "null for genesis agents" },
        dome_id: { type: "string" },
        generation: { type: "integer", minimum: 0 },
        specialization_hint: { type: "string", description: "Optional initial niche hint from DNA contract" },
      },
    },
    fn: registerAgentLineage,
  },
  emit_dome_event: {
    description:
      "Emit a typed lifecycle event to the dome event bus. Use for: MITOSIS (agent splitting), ORGAN_FORMED (new organ detected), CAPACITY_SATURATED (dome is full, suggests sibling dome), KNOWLEDGE_TRANSFER (sharing findings with Mouseion).",
    inputSchema: {
      type: "object",
      required: ["event_type"],
      properties: {
        event_type: {
          type: "string",
          enum: [
            "AGENT_SPAWNED", "AGENT_DIFFERENTIATED", "MITOSIS", "APOPTOSIS",
            "ORGAN_FORMED", "ORGAN_SATURATED", "CAPACITY_SATURATED",
            "TASK_POSTED", "TASK_COMPLETED", "BID_ACCEPTED",
            "HORIZONTAL_GENE_TRANSFER", "SPAWN_REQUEST", "KNOWLEDGE_TRANSFER",
          ],
        },
        source_dome_id: { type: "string" },
        target_dome_id: { type: "string", description: "null for local events" },
        payload: { type: "object", description: "Event-specific data" },
      },
    },
    fn: emitDomeEvent,
  },
  query_merge_recipe_archive: {
    description:
      "Query the Mouseion archive for validated organ merge recipes. Returns proven Sakana EMM-style recipes for assembling capable organs from base models. Used during organ formation when a new organ type is needed.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "e.g. 'oncological_research'" },
        organ_function: { type: "string", description: "e.g. 'hypothesis_generation'" },
      },
    },
    fn: queryMergeRecipeArchive,
  },
};

// ─────────────────────────────────────────────────────────
// MCP stdio message loop
// ─────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  if (method === "initialize") {
    sendResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mouseion", version: "0.1.0" },
    });
    return;
  }

  if (method === "tools/list") {
    sendResult(id, {
      tools: Object.entries(TOOLS).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    const tool = TOOLS[name];
    if (!tool) {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    try {
      const result = tool.fn(args || {});
      sendResult(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (e) {
      sendError(id, -32603, `Tool execution error: ${e.message}`);
    }
    return;
  }

  // Unhandled method
  sendError(id, -32601, `Method not found: ${method}`);
});

process.stderr.write("Mouseion MCP server started (stdio transport)\n");
