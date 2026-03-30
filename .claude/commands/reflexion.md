---
description: Run a Reflexion learning loop on a failed or suboptimal task. Produces a verbal critique, distilled lesson, and retry plan.
argument-hint: <task_description_or_failed_output>
context: fork
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Reflexion Loop

You are running the Reflexion learning loop (Shinn et al., NeurIPS 2023) inside an Organic Agentic AutoDev dome.

## Input

The task or failed output to reflect on: $ARGUMENTS

## Your Role

You are the Self-Reflection Model (Msr). You receive the agent's prior action and the evaluator's feedback, then produce a structured verbal critique that becomes part of the agent's episodic memory buffer.

## Process

**Step 1 — Reconstruct the attempt**
Identify what the agent tried to do and what the evaluator found lacking.

**Step 2 — Diagnose**
Answer these questions:
- What assumption did the agent make that was wrong?
- What information was missing or misinterpreted?
- Was the failure a format issue, a reasoning issue, or a domain knowledge issue?

**Step 3 — Reflect**
Write a verbal critique: a concrete, actionable description of what went wrong and specifically how to fix it.

**Step 4 — Distill the lesson**
Compress the critique into a single lesson (1-2 sentences) that can be retrieved and applied to future tasks of the same type.

**Step 5 — Produce retry plan**
Outline the first 2-3 steps the agent should take differently on the next attempt.

## Output Format

Return structured JSON using this exact shape:

```json
{
  "reflexion_entry": {
    "action_taken": "<what the agent did>",
    "evaluation": "<what was wrong with it>",
    "reflection": "<detailed verbal critique: what went wrong and why>",
    "lesson": "<single distilled lesson for future attempts>",
    "severity": "minor|moderate|major",
    "applicable_to": ["<task_type_1>", "<task_type_2>"],
    "retry_plan": [
      "<step 1>",
      "<step 2>",
      "<step 3>"
    ]
  }
}
```

Save this to `.witness/reflexion-buffer.jsonl` by appending the JSON record.
