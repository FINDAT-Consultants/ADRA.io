# ADRA Unified Work Evidence & Recovery Passport — Architecture

## Focal point: the Unified Work-Evidence Spine

The Master Time Schedule and Recovery Passport are not two parallel apps. They share one evidence spine.

```text
                    WORK ACTIVITY / MTS
 Employee • Department • Project • Activity • Clock-in/out
 Location • Document • Completion • Timeliness • Comments
                           │
                           ▼
                 Completed work evidence
                           │
                recovery_entry_id bridge
                           ▼
                 DRAFT RECOVERY TIME ENTRY
                           │
          ┌────────────────┼──────────────────┐
          ▼                ▼                  ▼
 Daily reconciliation  Eligibility       Evidence trace
          │                │                  │
          └────────────────┼──────────────────┘
                           ▼
                MONTHLY WORKBOOK ENGINE
 Expected hours • Payroll • Hourly cost • Allocations • Checks
                           │
                           ▼
                   RECOVERY PASSPORT
 Evidence × Capacity × Eligibility × Budget × Approval
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
            RECOVERABLE            BLOCKED
                                  + reason/action
```

## One data/AI system

```text
Browser — HTML/CSS/JavaScript
  │
  ├── Work Activity Hub (MTS)
  ├── Recovery operational views
  └── Recovery Agent
  │
  ▼
Node/Express API
  │
  ├── mts-store.js ───────────────┐
  ├── engine-runtime.js           │
  ├── knowledge-base.js           │
  ├── memory/record/session stores│  ← backend-only intelligence
  └── agents.js                   │
          │                       │
          ▼                       ▼
    OpenAI Agents SDK        Supabase / local fallback
          │                       │
          └──────────┬────────────┘
                     ▼
          Unified reasoning + actions
```

## Six intelligence layers

1. **Operational work evidence** — MTS sessions, clock evidence, activity, location, documents, completion and messages.
2. **Deterministic recovery engine** — the embedded workbook sheets, data and formula rules.
3. **Foundational knowledge** — Cost Recovery design + MTS operational design + unified-spine rules.
4. **Persistent system memory** — confirmed facts, decisions, instructions, lessons and labelled advice.
5. **Operational records** — tasks, notes, exceptions, follow-ups, messages and action audit.
6. **Session + coding learning** — Agents SDK conversation history and human-confirmed activity/project mappings.

## Authority hierarchy

| Evidence | Authority |
|---|---|
| Workbook/recovery engine | Financial calculations, eligibility, five-key gate, recovery status |
| MTS completed work session | Operational evidence of work session; becomes draft input, not approval |
| Foundational knowledge | Design/control rules |
| Confirmed memory | Durable confirmed context |
| Stored records/messages | Operational record; verify where necessary |
| MTS performance analytics | Management information only |
| Agent inference/advice | Advisory; never silently becomes accounting fact |

## Agent graph

```text
ADRA Recovery Passport Agent
│
├── Work Activity Evidence Agent
│   ├── get_work_activity_overview
│   ├── list_work_sessions
│   └── trace_work_evidence_to_recovery
│
├── Workbook Data Agent
├── Knowledge Base Agent
├── Recovery Calculation Agent
├── Memory & Learning Agent
├── Activity Coding Agent
└── Task Execution Agent
    ├── clock_in_work_session       [approval]
    ├── clock_out_work_session      [approval]
    ├── send_internal_message       [approval]
    ├── add_draft_time_entry        [approval]
    ├── create/update records
    └── save confirmed memory
```

## MTS performance analytics

The merged system preserves the Test 2 management concept:

```text
Worker performance score
= 70% × average completion
+ 30% × normalized completed hours
```

It also computes earliest clock-in/latest clock-out, overtime (>8 hours/day in the current work-activity rule set), job/project/department performance and employee-of-month. These signals may help the agent identify operational patterns but **do not affect the Recovery Gate unless a formally configured deterministic control explicitly uses them**.

## Supabase additions

Migrations 001–003 retain workbook, knowledge, memory, records and session infrastructure. Migration 004 adds:

```text
mts_work_sessions
mts_messages
```

`mts_work_sessions.recovery_entry_id` is the focal linkage to the Recovery Passport time-entry layer.

## No authentication yet

The application authenticates browser sessions through the API and applies Developer, company Administrator, and Employee role boundaries before operational routes execute. Supabase credentials remain server-side. Production deployments should mirror the same company/user boundaries with database-level RLS for defense in depth.

## Adaptive intelligence plane

A server-only intelligence plane now sits alongside—not above—the deterministic Recovery Assurance engine.

```text
Backend training reference ─┐
Human-confirmed mappings ───┼─> Feature store ─> ML classifiers ─┐
Confirmed live evidence ────┤                                  ├─> Advisory intelligence
Deterministic outcomes ─────┘                 Deep MLP ─────────┘
                                                                 │
                                                                 v
                                                    OpenAI Agents SDK reasoning
                                                                 │
                                                                 v
                                             Human review / deterministic controls
```

The adaptive layer may predict, prioritize and flag. It may not authorize financial posting or replace the five-key Recovery Passport gate.
