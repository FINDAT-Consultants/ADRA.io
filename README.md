# ADRA Unified Work Evidence & Recovery Passport System

This release uses the **Work Activity Hub** as the live operational evidence spine for the **ADRA Recovery Passport**. Historical prototype/workbook records are retained only as backend training/reference material and are excluded from live tables, dashboard totals, checks and vouchers.

## Access control and OpenAI execution

- **Developer** — hidden bootstrap identity with full application authority, company creation, account/data administration and role assignment. Default sign-in: `Dvp` with `Abcd\@1234` (the normalized `Abcd@1234` form is also accepted). Set `DEVELOPER_BOOTSTRAP_PASSWORD` in production to override the default.
- **Administrator** — scoped to the Administrator's company; may manage users, promote Employees to Administrator, appoint Supervisors/Heads of Department, manage controlled data, and approve/reject assigned items.
- **Employee** — registers with Employee ID, company code, name, and position/job title; receives restricted views and may work only with their own controlled work/document records where ownership applies.

Browser requests use a short-lived bearer session stored in `sessionStorage`; the server derives the user identity from that session rather than trusting client-submitted actor IDs. OpenAI agent/document-analysis tasks run through `@openai/agents` only when `OPENAI_API_KEY` is configured. There is no local-model, canned-response, or browser-local AI fallback. Keep the OpenAI API key on the deployed server/API layer rather than exposing it to browser JavaScript.


## The intersection: Unified Work-Evidence Spine

The focal point is a single evidence object that moves from **work performed** to **cost recovery**:

```text
MTS work session
 employee + department + project + activity
 clock-in/out + elapsed time + location + document
 completion + timeliness + comments
              │
              ▼
Completed operational evidence
              │
              ▼
DRAFT Recovery Passport time entry
              │
              ▼
Daily reconciliation + eligibility
              │
              ▼
Monthly payroll/hourly-cost allocation
              │
              ▼
Evidence × Capacity × Eligibility × Budget × Approval
              │
              ▼
Recovery Passport / blocked exception / recoverable cost
```

Every completed MTS record stores a `recovery_entry_id`, creating traceability from the live work session to the recovery calculation. The MTS performance analytics remain **management information only** and cannot authorize accounting.

### MTS features now integrated

- clock-in / clock-out and actual elapsed hours
- employee, department, project and activity evidence
- location evidence and supporting-document capture
- completion percentage, on-time review and delay/challenge comments
- Time per Individual / Hours per Job / Hours per Month
- top workers, daily analytics, overtime, employee-of-month, job/project/department performance
- internal operational messages
- JSON import/export and Excel-compatible export
- legacy work-record JSON normalization/import into the live Work Activity Hub
- MTS → Recovery Passport trace view
- Agent SDK tools to inspect, trace, clock-in, clock-out and message

Hard-coded MTS projects are not the financial authority. The embedded workbook **Projects** sheet is the canonical project master used by the merged system.

## OpenAI Agents SDK focal role

The main agent reasons across nine connected layers:

1. MTS operational work evidence
2. live deterministic workbook/recovery engine
3. backend historical training/reference archive
4. Cost Recovery + MTS foundational knowledge
5. persistent confirmed system memory
6. stored tasks/notes/messages/operational records
7. adaptive machine-learning/deep-learning intelligence
8. persistent conversation sessions + human-confirmed coding learning
9. deterministic mathematics, statistics and probability verification

Agent write tools are auditable; sensitive operations can require human approval. Financial calculations and Recovery Passport status remain deterministic.

### Context-aware reasoning brain

The Recovery Agent supports natural follow-up conversation, causal analysis, general non-current knowledge questions, system-grounded reasoning and verified quantitative problem solving. Numeric math/statistics/probability work is delegated to deterministic server-side calculation tools before results are stated. A predictive-compose endpoint can suggest short likely continuations while the user types; the displayed percentages are explicitly **estimated relative likelihoods among the shown alternatives**, not calibrated token log-probabilities.

The agent may explain conclusions, equations, evidence and key assumptions, but it does not expose private chain-of-thought. For current system facts it must retrieve live records/tools; for controlled financial actions it remains subject to human review and deterministic Recovery Gate controls.

## Supabase

Run migrations `001` through `004`. Migration `004_mts_unified_evidence_spine.sql` adds `mts_work_sessions` and `mts_messages` plus the `recovery_entry_id` bridge.

---


This full-stack application turns the supplied **ADRA Recovery Assurance Engine workbook** and **Cost Recovery design document** into a single operational intelligence system.

The application can be previewed by opening `index.html` directly or through GitHub Pages. The root page now loads the protected browser assets from `public/`, and GitHub Pages automatically uses browser-preview mode because GitHub Pages cannot run the Node/Express `/api/*` backend. For the full application with persistent server data, OpenAI Agents SDK reasoning, approvals, and optional Supabase persistence, run or deploy the Node server.

## Core principle

The OpenAI agent does not replace the workbook. It works **in tandem** with five evidence and memory layers:

```text
1. Foundational knowledge
   Cost Recovery design document + formula definitions

2. Deterministic workbook engine
   All workbook sheets, embedded records, formulas and Recovery Passport calculations

3. Persistent system memory
   Confirmed decisions, facts, instructions, lessons, policies and observations

4. Operational records and tasks
   Notes, tasks, exception notes, analyses and follow-ups created by the system

5. Conversation + learning memory
   Persistent Agents SDK session history and human-confirmed activity/project mappings
```

The agent may reason across these layers, identify patterns, make inferences, provide recommendations and perform supported tasks. **Accounting facts and numerical recovery calculations remain authoritative only when produced by the deterministic engine.**

---

## Embedded source coverage

### Workbook

All 11 workbook sheets are embedded:

| Workbook sheet | Application capability |
|---|---|
| Start Here | Internal workbook guidance retained for the backend engine; not exposed as a front-end page |
| Dashboard | KPI cards, monthly source data and visual analytics |
| Time Entry | Live user/Work Activity Hub evidence, assurance checks, filters and capture |
| Employees | Employee master data |
| Projects | Project, donor, eligibility and budget master data |
| Payroll | Salary, benefits, statutory cost, exclusions and allocable-cost logic |
| Calendar | Expected/recorded hours, variance and daily status |
| Monthly Engine | Allocation, readiness, exceptions and posting gate |
| Checks | Source reconciliation and configuration/control status |
| Voucher | Project/month voucher and Recovery Passport |
| Sources | Backend evidence, assumptions, limitations and configuration records; not exposed as a front-end page |

The source workbook is preserved at:

```text
data/source/ADRA_Recovery_Assurance_Engine_Prototype.xls
```

The complete normalized snapshot is stored at:

```text
data/training/workbook-demo-reference.json  # historical snapshot, training/reference only
data/training/workbook-demo-reference.json  # server-only historical training/reference archive
```

### Cost Recovery knowledge base

The complete supplied design document is preserved at:

```text
data/source/Cost Recovery.docx
```

It is transformed into two application knowledge assets:

```text
data/source_document_fulltext.json   # full ordered document blocks
data/knowledge-base.json             # retrieval-ready knowledge chunks
```

The knowledge base is used for design rules, control boundaries, workflow, recovery advice, roles and system rationale.

---

## Deterministic calculation engine

The workbook formulas are reproduced in:

```text
public/workbook-engine.js
```

The formula catalog contains **52 workbook rules**:

```text
data/workbook_formula_catalog.json
```

### Allocation chain

```text
Allocable Employment Cost
= Basic Salary + Eligible Benefits + Statutory Cost − Recoverability Exclusions

Employment Hourly Cost
= Allocable Employment Cost / Expected Monthly Hours

Direct Project Cost
= Finance-approved Direct Project Hours × Employment Hourly Cost

Administration Cost
= Finance-approved ADMIN Hours × Employment Hourly Cost

Unrecovered Cost
= Allocable Employment Cost − Direct Project Cost − Administration Cost
```

### Readiness

```text
Readiness
= 35% × completeness
+ 25% × daily reconciliation
+ 15% × eligibility
+ 15% × timeliness
+ 10% × approval
```

Readiness is management information. It does not authorize accounting.

### Recovery Passport

```text
Recovery Gate
= Evidence × Capacity × Eligibility × Budget × Approval

Recoverable Cost
= Approved Project Hours × Employment Hourly Cost × Recovery Gate
```

Each key is binary. One failed key blocks recovery while keeping the proposed underlying cost visible.

---

## Persistent intelligence architecture

### Foundational knowledge retrieval

`src/knowledge-base.js` searches the embedded Cost Recovery knowledge plus workbook formula definitions. The manager pre-retrieves relevant knowledge before every live OpenAI turn and can call the knowledge tools again if more evidence is needed.

### Persistent system memory

`src/memory-store.js` stores durable memory with explicit authority labels:

- `FOUNDATIONAL` — seeded system/control knowledge
- `CONFIRMED` — confirmed operational facts/decisions/instructions
- `OBSERVATION` — useful but non-authoritative observation
- `AGENT_ADVICE` — advice retained for later comparison, not accounting evidence

Local fallback:

```text
data/system-memory.json
```

Supabase table:

```text
agent_memories
```

### Persistent conversation sessions

`src/persistent-session.js` implements the Agents SDK `Session` interface with:

```text
getSessionId()
getItems()
addItems()
popItem()
clearSession()
```

Local fallback:

```text
data/conversation-sessions.json
```

Supabase table:

```text
agent_session_items
```

This means the live agent can continue a conversation across requests and server restarts when Supabase is configured.

### Operational records and tasks

`src/record-store.js` stores notes, tasks, exception notes, analyses, follow-ups and other system records.

Local fallback:

```text
data/system-records.json
```

Supabase table:

```text
system_records
```

Every tool-executed action can also be written to:

```text
agent_action_log
```

### Confirmed coding learning

`src/learning-store.js` retains human-confirmed activity-to-project mappings. They improve later suggestions but never silently post a code.

Local fallback:

```text
data/agent-learning.json
```

Supabase table:

```text
agent_learning_mappings
```

---

## OpenAI Agents SDK graph

The central agent is:

```text
ADRA Recovery Passport Intelligent Agent
```

It delegates to six specialist agents:

```text
Workbook Data Agent
Knowledge Base Agent
Recovery Calculation Agent
Memory and Learning Agent
Task Execution Agent
Activity Coding Agent
```

The manager uses dynamic instructions built from the current retrieval context, plus persistent session memory.

### Tool groups

**Workbook / deterministic data**

```text
get_workbook_overview
query_sheet
get_dashboard
calculate_monthly_engine
calculate_recovery_passport
get_control_checks
analyze_time_entries
get_calendar_analysis
get_master_data
get_formula_catalog
analyze_recovery_patterns
```

**Knowledge and memory**

```text
search_foundational_knowledge
get_knowledge_overview
search_system_memory
list_system_memory
save_system_memory
get_memory_overview
```

**Stored records and audit**

```text
search_stored_records
list_stored_records
save_system_record
update_record_status
get_agent_action_log
```

**Task execution and learning**

```text
add_draft_time_entry
suggest_project
record_confirmed_mapping
get_learning_status
```

### What the agent can do

The live agent can:

- answer questions grounded in the document, workbook and stored records;
- reason across current and historical data;
- analyze recovery patterns and exceptions;
- provide its own clearly labelled advice and inferences;
- suggest corrective actions and project coding;
- create notes, tasks and other operational records;
- remember durable confirmed facts, decisions and instructions;
- create draft time entries after human approval;
- update stored task/record status after human approval;
- learn from explicit human-confirmed coding decisions;
- maintain conversation context across turns;
- explain exactly which evidence or engine result supports an answer.

It can only **execute tasks for which a tool has been deliberately enabled**. Unsupported external actions should be proposed rather than falsely claimed as completed.

---

## Human-in-the-loop controls

Sensitive write tools use Agents SDK approval interruptions. The agent run pauses before execution and the browser displays the requested tool and arguments.

Currently approval-gated:

```text
clock_in_work_session
clock_out_work_session
send_internal_message
add_draft_time_entry
update_record_status
```

After approval or rejection, the serialized `RunState` is resumed from the same point.

This preserves the core boundary that AI may analyze, recommend and assist, but cannot autonomously approve time, determine salary, override donor restrictions or authorize journal entries.

---

## Backend knowledge and memory services

Knowledge retrieval, persistent memory, operational records, conversation sessions and confirmed coding patterns remain available to the server-side Recovery Agent. These implementation layers are intentionally not presented as separate front-end pages or management panels.

The user-facing **Recovery Agent** accesses the relevant context through the application server while keeping internal tools, memory stores and learning controls out of the interface.

---

## Data visualizations

The HTML/CSS/JavaScript interface includes engine-driven visualizations for:

- monthly cost composition;
- expected vs recorded hours;
- readiness trend;
- project-hour allocation;
- calendar variance;
- daily calendar status;
- Recovery Passport key status;
- dashboard KPIs;
- MTS top-worker performance;
- daily earliest/latest clock evidence;
- overtime flags;
- department and project operational performance.

---

## Open immediately — no account required

1. Extract the ZIP to a normal folder.
2. Double-click the root `index.html`.
3. Explore the application from the sidebar.

Direct-file mode is available only for inspecting the interface and limited browser-side capture. It deliberately does **not** imitate the Recovery Agent with canned replies. Full LLM reasoning, persistent memory, proactive notifications and task execution require the local Node server at `http://localhost:3000`.

---

## Run the full intelligent system

Requirements:

- Node.js 20+
- OpenAI API key
- optional Supabase project for persistent backend storage

Configure:

```bash
cp .env.example .env
```

Set:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.6

# Optional persistent backend
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=your_server_secret
```

Then:

```bash
npm install
npm run check
npm run verify-engine
npm run verify-memory
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Supabase setup

Run migrations in order:

```text
supabase/migrations/001_workbook_foundation.sql
supabase/migrations/002_seed_workbook.sql
supabase/migrations/003_agent_memory_knowledge_tasks.sql
```

The third migration adds:

```text
agent_memories
agent_session_items
system_records
agent_action_log
```

The application uses authenticated per-browser API sessions and role-based application controls for Developers, company Administrators, and Employees. Supabase privileged credentials remain server-side only; production deployments should additionally enforce matching database-level RLS policies.

---

## Verification

Run:

```bash
npm run check
npm run verify-engine
npm run verify-memory
```

`verify-engine` validates key workbook results. `verify-memory` validates embedded source integrity, knowledge coverage, seeded control memory and persistent-store files.

---

## Authority model

The most important production rule is:

```text
The agent is free to reason.
The agent is not free to invent accounting facts.
```

Evidence precedence:

```text
1. Deterministic workbook calculation / source data
2. Foundational control knowledge
3. Confirmed persistent memory
4. Stored operational records
5. Observations and agent advice
```

When evidence conflicts, the agent should explain the conflict rather than silently reconcile it.

## Management UI refresh (August 2026)
The live interface now adopts management-dashboard patterns from the supplied visual references without introducing sample operational records. The update adds:
- a people-focused dashboard summary with live employee, Work Activity and recovery metrics;
- payroll-distribution visualization, profile-based activity lists, an operational mini-calendar and a live attention queue;
- a global live-system search for employees, projects and Work Activity sessions;
- an Insights workspace with Activity, Performance, Engagement and Recovery tabs populated from live system data;
- a Reports & Analytics launcher for executive, workforce, recovery, project, payroll and Recovery Passport views.

All new cards and charts begin in a zero/live-ready state and populate only from user- or system-captured operational data. Archived workbook records remain backend training/reference data only.

## People Operations visual refresh
- Employee directory now uses a profile-led HRIS table layout with live search, status filtering, CSV export, profile pictures, employment type, status and location.
- Recruiting adds live Vacancies, Candidates, Funnel and Analytics views. Candidate stages are operational records, not seeded examples.
- Onboarding provides a five-step offer-to-employee workflow. Completing onboarding promotes the candidate into the shared Employee/Company master and preserves profile identity.
- Recruitment, onboarding, Company, Employees and Work Activity Hub all use the same live operational state. Historical workbook/demo material remains backend-only training/reference data.

## Dashboard Control Center

The live dashboard includes a top-center control dock for Notifications, Documents, Reviews, Settings and Profile.

- **Notifications** aggregates assigned review items, active tasks and unread internal messages. Resolved tasks/reviews and read messages disappear from the active notification list.
- **Documents** is the central live document inbox. Supporting documents submitted from Work Activity Hub are routed here automatically; manual uploads are also supported. Documents receive an automated pre-screen and remain pending until an assigned reviewer approves or rejects them. Approved documents are archived by department, project and employee under `data/approved-documents/` when file bytes are available.
- **Reviews** derives human-review work from time-evidence approval stages, payroll configuration, pending documents, blocked recovery controls and Recovery Agent actions. Review actions are restricted to the assigned reviewer or Administrator; blocked controls cannot be bypassed by approval.
- **Settings** contains country/currency selection plus default, employee and project operational hourly rates. Rates drive operational cost displays but do not replace authorized payroll values or financial recovery controls.
- **Profile** manages the current application identity and profile picture and provides sign-out/sign-in controls.

The Recovery Agent includes **New conversation** and **Clear conversation** controls. Dialog and drawer close (`×`) actions are explicitly wired in the browser client.

For model-based document pre-screening, configure `OPENAI_API_KEY`. Without a configured model key the document remains reviewable and the interface explicitly reports that AI model analysis is not configured; the system does not pretend an AI approval occurred.

---

## Adaptive machine learning + deep learning layer

This release adds a **server-only adaptive intelligence engine** in `src/intelligence-engine.js`. It is deliberately separated from the deterministic accounting engine.

### What learns

The learning feature store combines:

- the archived workbook snapshot marked `TRAINING_REFERENCE_ONLY / NON_LIVE_NON_POSTING`;
- human-confirmed activity → project mappings;
- newly captured live time evidence once it is confirmed/approved;
- deterministic monthly outcomes produced by the Recovery Assurance engine.

The system automatically refreshes its local models when live operational state or human-confirmed learning changes.

### Models

1. **Machine learning — project coding:** multinomial Naive Bayes classifier for advisory activity-to-project suggestions.
2. **Machine learning — recovery risk:** regularized logistic classifier using completeness, reconciliation, eligibility, timeliness, approval, hours variance, recovery rate and critical exceptions.
3. **Machine learning — anomaly detection:** adaptive robust median/MAD anomaly detection for unusual live time-entry hours.
4. **Deep learning:** compact server-side `8 → 12 → 6 → 1` neural network trained on recovery outcome features. It provides an advisory probability only.
5. **OpenAI Agents SDK:** deep-learning foundation-model reasoning over the deterministic engine, knowledge, memory, work evidence and the adaptive-model outputs when `OPENAI_API_KEY` is configured.

The model state is stored only at `data/ml-models.json`. It is not shipped as current accounting data to front-end tables.

### Cold-start behavior

The application begins in `REFERENCE_COLD_START`. Historical data can initialize pattern recognition, but confidence is explicitly constrained until sufficient **human-confirmed live data** accumulates. The archived workbook is never merged into live totals.

### Non-negotiable boundary

ML/DL predictions are **advisory management intelligence**. They cannot approve time, create authoritative payroll amounts, override donor eligibility, clear blocked controls, authorize a journal, or change a Recovery Passport gate. Those actions remain governed by the deterministic engine and assigned human reviewers.

### Intelligence API

```text
GET  /api/intelligence/status
GET  /api/intelligence/insights
GET  /api/intelligence/project-coding?activity=...
POST /api/intelligence/train
```

Manual retraining is restricted to the Administrator or a user with Settings permission. The Settings drawer displays Agents SDK connectivity, learning maturity, training-row counts and the deep-network architecture.

## Secure OpenAI Agents SDK configuration

The Agents SDK is already connected to the application server through the standard `OPENAI_API_KEY` environment variable. **Do not put a real API key in `public/`, HTML, JavaScript source, Git, or a downloadable ZIP.**

Create a fresh project key and configure it only in the server environment:

```bash
cp .env.example .env
# Edit .env locally/server-side and set OPENAI_API_KEY to the rotated project key.
npm start
```

`OPENAI_MODEL` defaults to `gpt-5.6` and can be changed through the server environment. `/api/health` and Settings report only whether the key is configured; the key value is never returned to the browser.

Run these verification commands before deployment:

```bash
npm run check
npm run verify-engine
npm run verify-memory
npm run verify-unified
npm run verify-intelligence
npm run verify-security
```

## System reasoning brain and proactive AI Advisor

The application includes a persistent server-side **System Brain** built on the OpenAI Agents SDK when `OPENAI_API_KEY` is configured. It is designed to make the product conversational and proactively helpful without weakening accounting authority.

### Conversation

- Each signed-in application user has a persistent AI Advisor thread.
- The Recovery Agent UI loads the user-visible conversation history and supports natural back-and-forth follow-ups.
- The agent reasons across live work evidence, deterministic recovery calculations, knowledge, confirmed memory, stored records and adaptive ML/DL signals.
- Explicit user commands can execute supported application tools immediately when the signed-in user has the required permission. Assigned review decisions are still enforced by backend reviewer/role checks, and failed deterministic controls cannot be bypassed.
- **New conversation** and **Clear conversation** clear both the user-visible thread and its Agents SDK session.

### Proactive advice

A server-side monitor watches actionable live conditions, including assigned reviews, pending tasks, blocked recovery periods, mature ML anomaly/risk signals and overtime indicators. When the state materially changes, the System Brain can create a concise **ADRA AI Advisor** message in Notifications. The message remains clearly identified as AI-generated.

Notifications are de-duplicated. If the underlying condition is resolved, stale AI advice is automatically marked resolved/read so it does not remain in the notification list. Users can also mark advice read or select **Reply** to continue the discussion in Recovery Agent.

### Accuracy and authority boundary

The advisor is instructed to retrieve and cross-check live evidence, distinguish facts from inference when material, state missing evidence, and avoid claiming a completed action unless a tool actually succeeded. Financial calculations, eligibility and Recovery Gate status remain with the deterministic engine. The Agent may carry out an assigned review decision when the signed-in user explicitly commands it and has the required backend authority; it cannot bypass failed controls or authorize accounting journal posting.


## Active LLM task execution and visible work trace (v4.3)

The Recovery Agent no longer uses a generic live-record-count response as a local fallback. In server mode, the current user message is sent to the OpenAI Agents SDK with persistent session context and application tools. Supported commands can create/update live Employees, Projects, Payroll, Calendar, Recovery Time, Recruiting and Onboarding records; operate Work Activity sessions and internal messages; update Settings when authorized; complete tasks; and approve/reject/acknowledge assigned Reviews when the signed-in user explicitly instructs that decision and the backend authorizes it.

Each tool execution emits a server-side activity event. While the command is running, the browser follows that event stream, opens the relevant module or control-center panel, scrolls to the relevant control and displays an AI cursor/highlight. The data change itself is performed by the audited backend tool; the on-screen cursor is a live visual trace of that real execution, not a second unaudited browser mutation.

Successful Agent actions create an unread **ADRA AI Advisor** task-completion notification. Proactive LLM advice is also generated for actionable review/task/recovery/work signals when an OpenAI connection is configured. Conversation memory records successful command patterns so future turns can use the user's established workflow while the foundation model itself is not silently retrained.

For local use, do not double-click `index.html` when you want the AI. Run `start-local.bat` on Windows or `./start-local.sh` on macOS/Linux after creating `.env` and setting a fresh `OPENAI_API_KEY`.
