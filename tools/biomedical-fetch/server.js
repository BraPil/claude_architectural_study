#!/usr/bin/env node
/**
 * Biomedical Fetch MCP Server
 *
 * Provides structured access to biomedical databases for ExMorbus agents.
 * Built by Tool Forge in response to agent TOOL_REQUEST events.
 *
 * Tools (4):
 *   1. pubmed_search    — search PubMed, return structured results
 *   2. pubmed_abstract  — fetch full abstract by PMID
 *   3. clinicaltrials_search — search ClinicalTrials.gov
 *   4. drugbank_search  — search DrugBank open data
 *
 * Transport: stdio (Claude Code MCP standard)
 */

import { createInterface } from "readline";

// ─────────────────────────────────────────────────────────
// Tool implementations
// ─────────────────────────────────────────────────────────

async function pubmedSearch({ query, max_results = 5, date_range }) {
  if (!query) return { error: "query is required" };

  const encodedQuery = encodeURIComponent(query + (date_range ? `+AND+${date_range}[dp]` : ""));
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=${max_results}&retmode=json&tool=organic-agentic-autodev&email=agent@exmorbus.research`;

  try {
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return { error: `PubMed search failed: ${searchResp.status}` };
    const searchData = await searchResp.json();
    const ids = searchData.esearchresult?.idlist || [];

    if (ids.length === 0) return { results: [], query, count: 0 };

    // Fetch summaries
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json&tool=organic-agentic-autodev`;
    const summaryResp = await fetch(summaryUrl);
    if (!summaryResp.ok) return { results: ids.map((id) => ({ pmid: id })), query };

    const summaryData = await summaryResp.json();
    const results = ids.map((id) => {
      const doc = summaryData.result?.[id] || {};
      return {
        pmid: id,
        title: doc.title || "Unknown",
        authors: (doc.authors || []).slice(0, 3).map((a) => a.name).join(", "),
        journal: doc.source || "",
        pub_date: doc.pubdate || "",
        doi: doc.elocationid || "",
      };
    });

    return { results, query, count: results.length, total_found: searchData.esearchresult?.count };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

async function pubmedAbstract({ pmid }) {
  if (!pmid) return { error: "pmid is required" };

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=text&rettype=abstract&tool=organic-agentic-autodev`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return { error: `Fetch failed: ${resp.status}`, pmid };
    const text = await resp.text();
    const lines = text.trim().split("\n").filter((l) => l.trim());
    return {
      pmid,
      abstract_text: text.trim().slice(0, 2000),
      line_count: lines.length,
      truncated: text.length > 2000,
    };
  } catch (e) {
    return { error: `Network error: ${e.message}`, pmid };
  }
}

async function clinicaltrialsSearch({ condition, intervention, status = "RECRUITING", max_results = 5 }) {
  if (!condition && !intervention) return { error: "condition or intervention is required" };

  const params = new URLSearchParams({
    format: "json",
    pageSize: String(max_results),
    ...(condition && { "query.cond": condition }),
    ...(intervention && { "query.intr": intervention }),
    ...(status && { "filter.overallStatus": status }),
    "fields": "protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule.overallStatus,protocolSection.designModule.phases,protocolSection.designModule.enrollmentInfo.count,protocolSection.statusModule.startDateStruct.date",
  });

  try {
    const resp = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`);
    if (!resp.ok) return { error: `ClinicalTrials API failed: ${resp.status}` };
    const data = await resp.json();
    const studies = (data.studies || []).map((s) => ({
      nct_id: s.protocolSection?.identificationModule?.nctId,
      title: s.protocolSection?.identificationModule?.briefTitle,
      status: s.protocolSection?.statusModule?.overallStatus,
      phase: s.protocolSection?.designModule?.phases?.[0],
      enrollment: s.protocolSection?.designModule?.enrollmentInfo?.count,
      start_date: s.protocolSection?.statusModule?.startDateStruct?.date,
    }));
    return { studies, condition, intervention, count: studies.length };
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }
}

async function drugbankSearch({ drug_name, target_gene }) {
  if (!drug_name && !target_gene) return { error: "drug_name or target_gene is required" };

  // DrugBank open data API (public endpoint)
  const query = drug_name || target_gene;
  const url = `https://go.drugbank.com/drugs/search.json?q=${encodeURIComponent(query)}&page=0`;

  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "organic-agentic-autodev/0.1" },
    });

    if (resp.status === 404 || resp.status === 403) {
      // Fallback: search PubMed for drug-target interaction papers
      const fallback = await pubmedSearch({
        query: `${query} drug interaction cancer mechanism`,
        max_results: 3,
      });
      return {
        source: "pubmed_fallback",
        note: "DrugBank API not available, returned PubMed drug interaction papers",
        drug_name: drug_name || target_gene,
        ...fallback,
      };
    }

    if (!resp.ok) return { error: `DrugBank search failed: ${resp.status}`, query };
    const data = await resp.json();
    return {
      source: "drugbank",
      query,
      drugs: (data.drugs || data || []).slice(0, 5).map((d) => ({
        name: d.name || d.drugbank_id,
        drugbank_id: d.drugbank_id,
        description: (d.description || "").slice(0, 200),
        drug_class: d.drug_type || d.groups,
      })),
    };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

// ─────────────────────────────────────────────────────────
// MCP tool registry
// ─────────────────────────────────────────────────────────

const TOOLS = {
  pubmed_search: {
    description:
      "Search PubMed for biomedical literature. Returns titles, authors, journal, and PMIDs. Use pubmed_abstract to fetch full text. Input: query (e.g. 'BRCA1 breast cancer pathway'), max_results (default 5), date_range (e.g. '2020:2026'). Returns structured result list, not raw XML.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "PubMed search query (supports MeSH terms and boolean operators)" },
        max_results: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        date_range: { type: "string", description: "Date range filter e.g. '2020:2026'" },
      },
    },
    fn: pubmedSearch,
  },
  pubmed_abstract: {
    description:
      "Fetch the full abstract text for a PubMed article by PMID. Use after pubmed_search to get the abstract for a specific paper. Input: pmid (string or integer). Returns abstract_text (truncated to 2000 chars), pmid, truncated flag.",
    inputSchema: {
      type: "object",
      required: ["pmid"],
      properties: {
        pmid: { type: "string", description: "PubMed article ID (PMID), e.g. '38234567'" },
      },
    },
    fn: pubmedAbstract,
  },
  clinicaltrials_search: {
    description:
      "Search ClinicalTrials.gov for active or completed trials. Use to identify trial gaps for Therapeutics dome. Input: condition (e.g. 'breast cancer'), intervention (e.g. 'pembrolizumab'), status (RECRUITING|COMPLETED|ACTIVE_NOT_RECRUITING, default RECRUITING), max_results (default 5). Returns NCT IDs, phases, enrollment.",
    inputSchema: {
      type: "object",
      properties: {
        condition: { type: "string", description: "Disease or condition, e.g. 'triple negative breast cancer'" },
        intervention: { type: "string", description: "Drug, device, or procedure name" },
        status: { type: "string", enum: ["RECRUITING", "COMPLETED", "ACTIVE_NOT_RECRUITING", "NOT_YET_RECRUITING"], default: "RECRUITING" },
        max_results: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
    },
    fn: clinicaltrialsSearch,
  },
  drugbank_search: {
    description:
      "Search DrugBank for drug-target interaction data. Useful for drug repurposing and mechanism analysis. Input: drug_name (e.g. 'imatinib') OR target_gene (e.g. 'BCR-ABL'). Falls back to PubMed interaction papers if DrugBank API is unavailable. Returns drug names, IDs, class, and descriptions.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Drug name or brand name, e.g. 'imatinib', 'Gleevec'" },
        target_gene: { type: "string", description: "Gene or protein target, e.g. 'BCR-ABL', 'EGFR'" },
      },
    },
    fn: drugbankSearch,
  },
};

// ─────────────────────────────────────────────────────────
// MCP stdio message loop
// ─────────────────────────────────────────────────────────

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;

  if (method === "initialize") {
    send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "biomedical-fetch", version: "0.1.0" } } });
    return;
  }
  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } });
    return;
  }
  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    const tool = TOOLS[name];
    if (!tool) { send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } }); return; }
    Promise.resolve(tool.fn(args || {}))
      .then((result) => send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } }))
      .catch((e) => send({ jsonrpc: "2.0", id, error: { code: -32603, message: `Tool error: ${e.message}` } }));
    return;
  }
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
});

process.stderr.write("Biomedical Fetch MCP server started (stdio transport)\n");
