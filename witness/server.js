#!/usr/bin/env node
/**
 * Witness Observer Dashboard Server
 *
 * Read-only HTTP server that exposes dome activity as a dashboard.
 * Humans connect here to observe the organic agentic system.
 *
 * Endpoints:
 *   GET /          — HTML dashboard
 *   GET /api/events       — dome-events.jsonl (last N)
 *   GET /api/observations — observations.jsonl (last N)
 *   GET /api/lineage      — agent lineage tree
 *   GET /api/lessons      — accumulated DNA lessons
 *   GET /api/reflexion    — reflexion episodic buffer
 *   GET /api/spawn-queue  — pending sibling dome spawn requests
 *   GET /api/summary      — dome health summary
 *   GET /stream           — SSE stream of live events (tail -f equivalent)
 *
 * Design principle: WITNESS-ONLY. No write endpoints. No agent control.
 * Humans observe but cannot intervene (Core Principle 6).
 */

import { createServer } from 'http';
import { readFileSync, existsSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || join(__dirname, '..');
const WITNESS_DIR = join(PROJECT_DIR, '.witness');
const PORT = parseInt(process.env.WITNESS_PORT || '9000');

// ─────────────────────────────────────────────────────────
// JSONL reader helpers
// ─────────────────────────────────────────────────────────

function readJsonl(filename, limit = 100) {
  const filepath = join(WITNESS_DIR, filename);
  if (!existsSync(filepath)) return [];
  try {
    const lines = readFileSync(filepath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    return lines.slice(-limit);
  } catch {
    return [];
  }
}

function domeSummary() {
  const events = readJsonl('dome-events.jsonl', 500);
  const lineage = readJsonl('lineage.jsonl', 500);
  const lessons = readJsonl('dna-lessons.jsonl', 500);

  const agentsByState = {};
  const organEvents = events.filter((e) => e.event_type === 'ORGAN_FORMED');
  const mitosisEvents = events.filter((e) => e.event_type === 'MITOSIS');
  const taskCompletions = events.filter((e) => e.event_type === 'TASK_COMPLETED');
  const capacityEvents = events.filter((e) => e.event_type === 'CAPACITY_SATURATED');
  const spawnEvents = events.filter((e) => e.event_type === 'SPAWN_REQUEST');

  lineage.forEach((a) => {
    const state = a.event_type === 'AGENT_SPAWNED' ? 'spawned' : a.event_type;
    agentsByState[state] = (agentsByState[state] || 0) + 1;
  });

  return {
    dome_id: process.env.DOME_ID || 'exmorbus-v0.2',
    timestamp: new Date().toISOString(),
    agents: {
      total: lineage.length,
      by_event: agentsByState,
    },
    organs_formed: organEvents.length,
    mitosis_events: mitosisEvents.length,
    tasks_completed: taskCompletions.length,
    lessons_recorded: lessons.length,
    capacity_signals: capacityEvents.length,
    spawn_requests: spawnEvents.length,
    last_event: events[events.length - 1] || null,
    health: events.length > 0 ? 'active' : 'idle',
  };
}

// ─────────────────────────────────────────────────────────
// SSE clients registry
// ─────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcastEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

// Watch witness files for live updates
['dome-events.jsonl', 'observations.jsonl'].forEach((file) => {
  const filepath = join(WITNESS_DIR, file);
  try {
    watchFile(filepath, { interval: 1000 }, () => {
      const lines = readJsonl(file, 1);
      if (lines.length > 0) broadcastEvent({ file, event: lines[lines.length - 1] });
    });
  } catch { /* file may not exist yet */ }
});

// ─────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const limit = parseInt(url.searchParams.get('limit') || '100');

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.writeHead(405).end(JSON.stringify({ error: 'Witness layer is read-only' }));
    return;
  }

  // ── SSE stream ──────────────────────────────────────
  if (path === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', dome_id: process.env.DOME_ID || 'exmorbus-v0.2' })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── JSON API ─────────────────────────────────────────
  if (path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    let data;
    switch (path) {
      case '/api/events':       data = readJsonl('dome-events.jsonl', limit); break;
      case '/api/observations': data = readJsonl('observations.jsonl', limit); break;
      case '/api/lineage':      data = readJsonl('lineage.jsonl', limit); break;
      case '/api/lessons':      data = readJsonl('dna-lessons.jsonl', limit); break;
      case '/api/reflexion':    data = readJsonl('reflexion-buffer.jsonl', limit); break;
      case '/api/spawn-queue':  data = readJsonl('spawn-queue.jsonl', limit); break;
      case '/api/experiments':  data = readJsonl('experiments', limit); break;
      case '/api/summary':      data = domeSummary(); break;
      case '/api/evaluations': {
        let evals = readJsonl('evaluations.jsonl', limit);
        const minScore = parseFloat(url.searchParams.get('min_score') || '0');
        const vFilter = url.searchParams.get('verdict');
        const ftFilter = url.searchParams.get('finding_type');
        if (minScore > 0) evals = evals.filter(e => (e.composite_score || 0) >= minScore);
        if (vFilter) evals = evals.filter(e => e.verdict === vFilter);
        if (ftFilter) evals = evals.filter(e => e.finding_type === ftFilter);
        data = { evaluations: evals, count: evals.length };
        break;
      }
      default:
        res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
        return;
    }
    res.writeHead(200).end(JSON.stringify(data, null, 2));
    return;
  }

  // ── Dashboard HTML ────────────────────────────────────
  if (path === '/' || path === '/index.html') {
    const htmlPath = join(__dirname, 'index.html');
    if (existsSync(htmlPath)) {
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200).end(readFileSync(htmlPath, 'utf8'));
    } else {
      res.writeHead(404).end('Dashboard HTML not found');
    }
    return;
  }

  res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  process.stderr.write(`Witness Observer running on http://localhost:${PORT}\n`);
  process.stderr.write(`Watching: ${WITNESS_DIR}\n`);
});
