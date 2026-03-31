#!/usr/bin/env node
/**
 * Biomedical Fetch MCP Server
 *
 * Provides structured access to biomedical databases for ExMorbus agents.
 * Built by Tool Forge in response to agent TOOL_REQUEST events.
 *
 * Tools (10):
 *   1. pubmed_search          — search PubMed, return structured results
 *   2. pubmed_abstract        — fetch full abstract by PMID
 *   3. clinicaltrials_search  — search ClinicalTrials.gov
 *   4. drugbank_search        — search DrugBank open data
 *   5. semantic_scholar_search — search with citation velocity + abstract previews
 *   6. openalex_search        — 200M+ works, concept tagging, broader coverage
 *   7. europe_pmc_search      — includes bioRxiv/medRxiv preprints
 *   8. reactome_pathway       — gene→pathway lookup, Reactome hierarchy
 *   9. uniprot_search         — protein function, diseases, interactions
 *  10. cbioportal_query       — TCGA methylation and study discovery
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

async function semanticScholarSearch({ query, max_results = 5, fields = "paperId,title,authors,year,citationCount,influentialCitationCount,abstract,externalIds,venue" }) {
  if (!query) return { error: "query is required" };
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${max_results}&fields=${fields}`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "organic-agentic-autodev/0.1" } });
    if (!resp.ok) return { error: `Semantic Scholar API failed: ${resp.status}`, query };
    const data = await resp.json();
    const results = (data.data || []).map(p => ({
      s2_id: p.paperId,
      pmid: p.externalIds?.PubMed || null,
      doi: p.externalIds?.DOI || null,
      title: p.title,
      authors: (p.authors || []).slice(0, 3).map(a => a.name).join(", "),
      year: p.year,
      venue: p.venue,
      citations: p.citationCount,
      influential_citations: p.influentialCitationCount,
      abstract_preview: (p.abstract || "").slice(0, 300),
    }));
    return { results, query, count: results.length, total_found: data.total };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

async function openAlexSearch({ query, max_results = 5, filter }) {
  if (!query) return { error: "query is required" };
  const params = new URLSearchParams({
    search: query,
    per_page: String(max_results),
    select: "id,doi,title,authorships,publication_year,cited_by_count,concepts,primary_location,ids",
    mailto: "agent@exmorbus.research",
  });
  if (filter) params.set("filter", filter);
  try {
    const resp = await fetch(`https://api.openalex.org/works?${params}`);
    if (!resp.ok) return { error: `OpenAlex API failed: ${resp.status}`, query };
    const data = await resp.json();
    const results = (data.results || []).map(w => ({
      openalex_id: w.id,
      pmid: w.ids?.pmid?.replace("https://pubmed.ncbi.nlm.nih.gov/", "") || null,
      doi: w.doi,
      title: w.title,
      authors: (w.authorships || []).slice(0, 3).map(a => a.author?.display_name).join(", "),
      year: w.publication_year,
      venue: w.primary_location?.source?.display_name,
      cited_by_count: w.cited_by_count,
      top_concepts: (w.concepts || []).slice(0, 4).map(c => `${c.display_name} (${(c.score * 100).toFixed(0)}%)`),
    }));
    return { results, query, count: results.length, total_found: data.meta?.count };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

async function europePmcSearch({ query, max_results = 5, source = "MED,PPR", sort = "CITED desc" }) {
  if (!query) return { error: "query is required" };
  const params = new URLSearchParams({
    query,
    resultType: "core",
    pageSize: String(max_results),
    format: "json",
    sort,
    src: source,
  });
  try {
    const resp = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`);
    if (!resp.ok) return { error: `Europe PMC API failed: ${resp.status}`, query };
    const data = await resp.json();
    const results = (data.resultList?.result || []).map(p => ({
      pmid: p.pmid || null,
      pmcid: p.pmcid || null,
      title: p.title,
      authors: p.authorString?.slice(0, 80),
      journal: p.journalTitle,
      year: p.pubYear,
      citations: p.citedByCount,
      is_preprint: p.source === "PPR",
      doi: p.doi,
    }));
    return { results, query, count: results.length, total_found: data.hitCount };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

async function reactomePathway({ gene, pathway_id, action = "gene_to_pathways" }) {
  try {
    let url, label;
    if (action === "gene_to_pathways" && gene) {
      url = `https://reactome.org/ContentService/data/mapping/UniProt/${encodeURIComponent(gene)}/pathways?species=9606&onlyDiagrammed=false`;
      label = `pathways containing ${gene}`;
    } else if (action === "pathway_details" && pathway_id) {
      url = `https://reactome.org/ContentService/data/pathway/${encodeURIComponent(pathway_id)}/containedEvents`;
      label = `events in pathway ${pathway_id}`;
    } else if (action === "search" && gene) {
      url = `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(gene)}&species=Homo+sapiens&cluster=true&Start=0&rows=5`;
      label = `search: ${gene}`;
    } else {
      return { error: "Provide gene (for gene_to_pathways/search) or pathway_id (for pathway_details)" };
    }
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return { error: `Reactome API failed: ${resp.status}`, action, gene, pathway_id };
    const data = await resp.json();
    if (action === "gene_to_pathways") {
      const pathways = (Array.isArray(data) ? data : data.results || []).slice(0, 10).map(p => ({
        id: p.stId || p.dbId,
        name: p.displayName || p.name,
        species: p.speciesName,
        diagram: p.hasDiagram,
      }));
      return { gene, label, pathways, count: pathways.length };
    }
    if (action === "search") {
      const entries = (data.results || []).slice(0, 8).map(r => ({ id: r.stId, name: r.displayName, type: r.exactType, species: r.speciesName?.[0] }));
      return { query: gene, results: entries, count: entries.length };
    }
    return { pathway_id, events: Array.isArray(data) ? data.slice(0, 10) : data };
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }
}

async function uniprotSearch({ gene, protein_name, action = "search" }) {
  const query = gene || protein_name;
  if (!query) return { error: "gene or protein_name is required" };
  try {
    if (action === "search") {
      const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}+AND+organism_id:9606&format=json&fields=accession,gene_names,protein_name,organism_name,annotation_score,cc_function,cc_disease,cc_interaction&size=5`;
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (!resp.ok) return { error: `UniProt API failed: ${resp.status}`, query };
      const data = await resp.json();
      const results = (data.results || []).map(p => ({
        accession: p.primaryAccession,
        gene: p.genes?.[0]?.geneName?.value,
        protein: p.proteinDescription?.recommendedName?.fullName?.value,
        annotation_score: p.annotationScore,
        function: (p.comments?.find(c => c.commentType === "FUNCTION")?.texts?.[0]?.value || "").slice(0, 300),
        diseases: (p.comments?.filter(c => c.commentType === "DISEASE") || []).map(c => c.disease?.diseaseId).join(", "),
        interactions: (p.comments?.find(c => c.commentType === "INTERACTION")?.interactions || []).slice(0, 5).map(i => i.interactantTwo?.geneName || i.interactantTwo?.uniProtKBAccession).join(", "),
      }));
      return { query, results, count: results.length };
    }
    return { error: `Unknown action: ${action}` };
  } catch (e) {
    return { error: `Network error: ${e.message}`, query };
  }
}

async function cbioportalQuery({ study_id, action, molecular_profile_id, sample_list_id, gene_list, patient_attribute }) {
  const BASE = "https://www.cbioportal.org/api";
  try {
    if (action === "methylation" && study_id && gene_list) {
      // Get methylation data for genes in a study
      const profileResp = await fetch(`${BASE}/molecular-profiles?studyId=${study_id}`, { headers: { Accept: "application/json" } });
      if (!profileResp.ok) return { error: `cBioPortal profiles failed: ${profileResp.status}` };
      const profiles = await profileResp.json();
      const methProfile = profiles.find(p => p.molecularAlterationType === "METHYLATION");
      if (!methProfile) return { error: "No methylation profile found", study_id };
      const sampleListResp = await fetch(`${BASE}/sample-lists?studyId=${study_id}`, { headers: { Accept: "application/json" } });
      const sampleLists = await sampleListResp.json();
      const allSamples = sampleLists.find(s => s.category === "all_cases_in_study");
      const body = { entrezGeneIds: [], geneIds: gene_list, sampleListId: allSamples?.sampleListId };
      const dataResp = await fetch(`${BASE}/molecular-profiles/${methProfile.molecularProfileId}/molecular-data/fetch?projection=SUMMARY`, {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!dataResp.ok) return { error: `Methylation data fetch failed: ${dataResp.status}` };
      const data = await dataResp.json();
      return { study_id, profile: methProfile.molecularProfileId, gene_list, data_points: data.length, sample: data.slice(0, 5) };
    }
    if (action === "studies") {
      const resp = await fetch(`${BASE}/cancer-types/${study_id || "brca"}/studies`, { headers: { Accept: "application/json" } });
      if (!resp.ok) return { error: `Studies fetch failed: ${resp.status}` };
      const data = await resp.json();
      return { studies: data.map(s => ({ id: s.studyId, name: s.name, samples: s.allSampleCount })), count: data.length };
    }
    return { error: `Unknown action: ${action}. Use: methylation, studies` };
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }
}

// ─────────────────────────────────────────────────────────
// HuggingFace Inference API gateway
// Requires HF_TOKEN env var. Free tier supports:
//   - PubMedBERT (microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract)
//   - BioMedLM   (stanford-crfm/BioMedLM) — 2.7B biomedical GPT
//   - ESM2-8M    (facebook/esm2_t6_8M_UR50D) — protein embeddings
// ─────────────────────────────────────────────────────────

const HF_MODELS = {
  pubmedbert: "microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
  biomedlm:   "stanford-crfm/BioMedLM",
  esm2_tiny:  "facebook/esm2_t6_8M_UR50D",
  esm2_small: "facebook/esm2_t12_35M_UR50D",
  biomistral: "BioMistral/BioMistral-7B",
  scibert:    "allenai/scibert_scivocab_cased",
};

async function huggingfaceInference({ model_key, task, input, options = {} }) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return {
      error: "HF_TOKEN environment variable not set. Add it to .mcp.json env block: \"HF_TOKEN\": \"hf_xxxx\"",
      setup_instructions: "1. Create free account at huggingface.co  2. Go to Settings > Access Tokens  3. Create token (read scope)  4. Add to .mcp.json: {\"mcpServers\":{\"biomedical-fetch\":{\"env\":{\"HF_TOKEN\":\"hf_your_token\"}}}}",
      available_models: HF_MODELS,
    };
  }

  const modelId = HF_MODELS[model_key] || model_key;
  const url = `https://router.huggingface.co/hf-inference/models/${modelId}/pipeline/${task}`;

  const body = task === "feature-extraction"
    ? { inputs: input }
    : task === "text-generation"
    ? { inputs: input, parameters: { max_new_tokens: options.max_tokens || 256, temperature: options.temperature || 0.3, return_full_text: false } }
    : { inputs: input };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (resp.status === 503) return { error: "Model loading (cold start). Retry in 20s.", model: modelId };
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `HuggingFace API failed: ${resp.status}`, detail: errText.slice(0, 200), model: modelId };
    }

    const data = await resp.json();
    if (task === "feature-extraction") {
      // Return embedding statistics (not raw vectors to avoid flooding context)
      const flat = Array.isArray(data[0]) ? data[0] : data;
      const dims = Array.isArray(flat[0]) ? flat[0].length : flat.length;
      return { model: modelId, task, embedding_dims: dims, sample_first_4: (Array.isArray(flat[0]) ? flat[0] : flat).slice(0, 4), note: "Full embedding vector available — use for cosine similarity scoring" };
    }
    return { model: modelId, task, result: data };
  } catch (e) {
    return { error: `Network error: ${e.message}`, model: modelId };
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
  semantic_scholar_search: {
    description:
      "Search Semantic Scholar for biomedical literature with citation metrics. PREFER OVER pubmed_search when: (1) you need citation velocity/influence ranking, (2) you need to find highly-cited papers on a topic, (3) you want abstract previews with results. Input: query (natural language or keywords), max_results (default 5). Returns title, authors, year, citation counts, and abstract preview. Use pubmed_abstract for full abstracts by PMID.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Natural language search query, e.g. 'BRCA1 methylation PARP inhibitor breast cancer'" },
        max_results: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
    },
    fn: semanticScholarSearch,
  },
  openalex_search: {
    description:
      "Search OpenAlex (200M+ academic works) for biomedical literature. USE WHEN: (1) pubmed_search returns 0 results (broader coverage), (2) you need concept tagging (automatically tags papers with biological concepts), (3) you need papers from non-PubMed venues (conference papers, book chapters). Input: query (natural language), max_results (default 5), filter (e.g. 'publication_year:>2020'). Returns title, authors, year, citations, venue, and top concepts.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search query, e.g. 'ferroptosis SLC7A11 breast cancer'" },
        max_results: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        filter: { type: "string", description: "OpenAlex filter string, e.g. 'publication_year:>2020' or 'concepts.id:C2777903' (concept filter)" },
      },
    },
    fn: openAlexSearch,
  },
  europe_pmc_search: {
    description:
      "Search Europe PMC for biomedical literature including PREPRINTS (bioRxiv/medRxiv). USE WHEN: (1) you need very recent findings not yet indexed in PubMed, (2) looking for preprint data from bioRxiv/medRxiv, (3) need papers with full-text availability in PMC. Input: query, max_results (default 5), source ('MED,PPR' includes preprints; 'MED' for PubMed only; 'PPR' for preprints only). Returns title, authors, year, citation count, and is_preprint flag.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search query, e.g. 'T-DXd ferroptosis HER2'" },
        max_results: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        source: { type: "string", description: "Source filter: 'MED,PPR' (default, includes preprints), 'MED' (PubMed only), 'PPR' (preprints only)", default: "MED,PPR" },
        sort: { type: "string", description: "Sort order: 'CITED desc' (most cited first, default) or 'P_PDATE_D desc' (most recent)", default: "CITED desc" },
      },
    },
    fn: europePmcSearch,
  },
  reactome_pathway: {
    description:
      "Query Reactome pathway database for human pathway analysis. Three actions: (1) 'gene_to_pathways' (default): find all Reactome pathways containing a gene — input: gene (e.g. 'BRCA1', 'SLC7A11', 'CDH1'); (2) 'search': text search Reactome for pathway names — input: gene/query; (3) 'pathway_details': get events within a specific pathway — input: pathway_id (e.g. 'R-HSA-5669034'). Returns pathway IDs, names, and hierarchy level. CRITICAL: use to verify mechanistic claims like 'CDH1→PI3K' or 'NRF2→SLC7A11' have Reactome pathway support.",
    inputSchema: {
      type: "object",
      properties: {
        gene: { type: "string", description: "Gene symbol, e.g. 'NRF2', 'CDH1', 'SLC7A11', 'LATS1'" },
        pathway_id: { type: "string", description: "Reactome pathway stable ID, e.g. 'R-HSA-5669034'" },
        action: { type: "string", enum: ["gene_to_pathways", "pathway_details", "search"], default: "gene_to_pathways" },
      },
    },
    fn: reactomePathway,
  },
  uniprot_search: {
    description:
      "Search UniProt for human protein function, disease associations, and interaction partners. USE WHEN: verifying gene function claims, finding protein isoforms, checking known disease associations, or identifying interaction partners for pathway analysis. Input: gene (gene symbol, e.g. 'BRCA1') OR protein_name (e.g. 'Breast cancer type 1'). Returns function summary, disease associations, and top interaction partners.",
    inputSchema: {
      type: "object",
      properties: {
        gene: { type: "string", description: "Gene symbol, e.g. 'BRCA1', 'SLC7A11', 'CDH1', 'NRF2'" },
        protein_name: { type: "string", description: "Protein name or keyword, e.g. 'E-cadherin', 'GPX4'" },
        action: { type: "string", enum: ["search"], default: "search" },
      },
    },
    fn: uniprotSearch,
  },
  huggingface_inference: {
    description:
      "Call HuggingFace Inference API for specialized biomedical ML models. Requires HF_TOKEN env var. Best uses: (1) 'pubmedbert' + 'feature-extraction' → semantic embeddings for hypothesis similarity scoring; (2) 'biomedlm' + 'text-generation' → cost-efficient biomedical QA alternative to Claude Haiku; (3) 'esm2_tiny' or 'esm2_small' + 'feature-extraction' → protein sequence embeddings (Claude CANNOT do this). Available model_keys: pubmedbert, biomedlm, esm2_tiny, esm2_small, biomistral, scibert. If HF_TOKEN not set, returns setup instructions.",
    inputSchema: {
      type: "object",
      required: ["model_key", "task", "input"],
      properties: {
        model_key: { type: "string", description: "Model alias: pubmedbert | biomedlm | esm2_tiny | esm2_small | biomistral | scibert. Or full HuggingFace model ID." },
        task: { type: "string", enum: ["feature-extraction", "text-generation", "fill-mask", "question-answering"], description: "Inference task type" },
        input: { description: "Input text (string) or for question-answering: {question, context} object" },
        options: { type: "object", description: "Optional: {max_tokens: 256, temperature: 0.3} for text-generation" },
      },
    },
    fn: huggingfaceInference,
  },
  cbioportal_query: {
    description:
      "Query cBioPortal genomic database for TCGA and other cancer genomic data. Actions: (1) 'methylation': get methylation beta values for specific genes in a study — inputs: study_id (e.g. 'brca_tcga'), gene_list (array, e.g. ['SLC7A11', 'BRCA1']); (2) 'studies': list available studies for a cancer type — input: study_id as cancer type code (e.g. 'brca'). For complex queries (expression data, PAM50 subtypes) use bash python3 with the cBioPortal REST API directly. Returns methylation values and study metadata.",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        study_id: { type: "string", description: "cBioPortal study ID, e.g. 'brca_tcga', 'brca_tcga_pan_can_atlas_2018'" },
        action: { type: "string", enum: ["methylation", "studies"], description: "Query action type" },
        gene_list: { type: "array", items: { type: "string" }, description: "Gene symbols for methylation query, e.g. ['SLC7A11', 'BRCA1']" },
      },
    },
    fn: cbioportalQuery,
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
    send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "biomedical-fetch", version: "0.2.0" } } });
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
