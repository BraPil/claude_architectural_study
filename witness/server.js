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
import { readFileSync, existsSync, watchFile, readdirSync, statSync } from 'fs';
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
// Discoveries: read experiment output files
// ─────────────────────────────────────────────────────────

function generateLaymanAbstract(exp) {
  const result = exp.result || '';
  const primary = exp.primary_finding?.key_result || exp.primary_finding?.finding || '';
  const refined = exp.hypothesis_refinement?.refined_claim_v4 || exp.hypothesis_refinement?.clinical_implication || '';
  const score = exp.score_update?.score_after;

  let opening = '';
  if (result.includes('CRITICAL_POSITIVE')) {
    opening = 'Major discovery: We found direct published evidence confirming a key part of our theory. ';
  } else if (result.includes('GAP_CONFIRMED_STRONG') || result.includes('GAP_CONFIRMED_WITH_STRONG')) {
    opening = 'Strong confirmation: We searched extensively and found this treatment angle has never been studied — meaning it\'s a wide-open opportunity. ';
  } else if (result.includes('GAP_CONFIRMED_WITH_SUPPORT')) {
    opening = 'Promising finding: We confirmed an unstudied gap while also finding supporting evidence nearby. ';
  } else if (result.includes('GAP_CONFIRMED')) {
    opening = 'Gap confirmed: No prior research exists on this specific question — our proposed study would be the first. ';
  } else if (result.includes('PARTIAL_SUPPORT')) {
    opening = 'Partial evidence found: We discovered a related mechanism that partially supports our theory and points toward a new angle. ';
  } else if (result.includes('INCONCLUSIVE')) {
    opening = 'Inconclusive: The data we needed wasn\'t publicly available yet — this question stays open. ';
  } else {
    opening = 'Research update: ';
  }

  let body = primary.slice(0, 200) + (primary.length > 200 ? '...' : '');
  if (!body && refined) body = refined.slice(0, 200) + (refined.length > 200 ? '...' : '');

  const confidence = score ? ` Current confidence: ${(score * 100).toFixed(0)}%.` : '';
  return opening + body + confidence;
}

function readDiscoveries(limit = 10) {
  const expDir = join(WITNESS_DIR, 'experiments');
  if (!existsSync(expDir)) return [];
  try {
    const files = readdirSync(expDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const fp = join(expDir, f);
          const data = JSON.parse(readFileSync(fp, 'utf8'));
          // Only include files that look like experiment outputs
          if (!data.result && !data.finding_type && !data.primary_finding) return null;
          return { _filename: f, _mtime: statSync(fp).mtime.getTime(), ...data };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b._mtime - a._mtime)
      .slice(0, limit);

    return files.map(exp => ({
      ...exp,
      layman_abstract: generateLaymanAbstract(exp),
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────
// Colony summary: agent clustering by niche
// ─────────────────────────────────────────────────────────

function colonySummary() {
  const statePath = join(WITNESS_DIR, 'swarm-state.json');
  let agentMap = {};
  if (existsSync(statePath)) {
    try { agentMap = JSON.parse(readFileSync(statePath, 'utf8')).agents || {}; } catch {}
  }

  const niches = {};
  Object.entries(agentMap).forEach(([id, a]) => {
    const niche = a.niche || 'undifferentiated';
    if (!niches[niche]) niches[niche] = { count: 0, total_rc: 0, max_rc: 0, differentiated: 0, agents: [] };
    const rc = a.role_commitment || 0;
    niches[niche].count++;
    niches[niche].total_rc += rc;
    niches[niche].max_rc = Math.max(niches[niche].max_rc, rc);
    if (rc >= 0.60) niches[niche].differentiated++;
    niches[niche].agents.push({ id, rc, state: a.lifecycle_state, tasks: a.tasks_completed || 0 });
  });

  Object.values(niches).forEach(n => { n.avg_rc = n.total_rc / n.count; });

  // Organ events
  const events = readJsonl('dome-events.jsonl', 500);
  const organNiches = new Set(
    events.filter(e => e.event_type === 'ORGAN_FORMED')
      .map(e => e.payload?.niche || e.payload?.organ_niche).filter(Boolean)
  );
  const mitosisCount = events.filter(e => e.event_type === 'MITOSIS').length;

  return {
    niches,
    organ_niches: [...organNiches],
    total_agents: Object.keys(agentMap).length,
    mitosis_total: mitosisCount,
  };
}

// ─────────────────────────────────────────────────────────
// Mitosis heatmap: spawn density by niche × time
// ─────────────────────────────────────────────────────────

function mitosisHeatmap() {
  const events = readJsonl('dome-events.jsonl', 2000);
  const spawns = events.filter(e => ['AGENT_SPAWNED', 'MITOSIS'].includes(e.event_type));

  const buckets = {};
  const nicheSet = new Set();
  const daySet = new Set();

  spawns.forEach(e => {
    const ts = e.ts || e.recorded_at || '';
    const day = ts.slice(0, 10) || 'unknown';
    const niche = e.payload?.niche || e.payload?.role || 'undifferentiated';
    nicheSet.add(niche);
    daySet.add(day);
    const key = `${day}||${niche}`;
    buckets[key] = (buckets[key] || 0) + 1;
  });

  const maxCount = Math.max(1, ...Object.values(buckets));
  return {
    buckets,
    niches: [...nicheSet].sort(),
    days: [...daySet].sort(),
    max_count: maxCount,
    total_spawns: spawns.length,
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
      case '/api/experiments':    data = readJsonl('experiments', limit); break;
      case '/api/discoveries':    data = readDiscoveries(limit || 10); break;
      case '/api/colonies':       data = colonySummary(); break;
      case '/api/mitosis-heatmap': data = mitosisHeatmap(); break;
      case '/api/summary':        data = domeSummary(); break;
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
