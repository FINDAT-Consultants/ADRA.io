# Implementation Notes — Agent Memory and Knowledge Grounding

## Goal

Give the ADRA Recovery Passport Agent enough durable context to act like an operational system agent without allowing model-generated text to become unverified accounting evidence.

## Memory is not one thing

The build deliberately separates:

1. **Foundational knowledge** — source-controlled design knowledge.
2. **Deterministic state** — workbook-derived calculations and operational data.
3. **Long-term application memory** — confirmed facts/decisions/instructions and lower-authority observations/advice.
4. **Stored records/tasks** — operational content the agent/user creates.
5. **Conversation history** — the current/recurrent dialogue state.
6. **Confirmed coding learning** — an auditable adaptive layer.

This separation lets the model reason broadly while preserving provenance and authority.

## Memory authority labels

- `FOUNDATIONAL`: system-seeded control or design knowledge.
- `CONFIRMED`: explicitly confirmed durable memory.
- `OBSERVATION`: contextual observation, not a control fact.
- `AGENT_ADVICE`: prior advice, useful for comparison but not an accounting fact.

## Retrieval

At the beginning of a live request, `buildGrounding()` retrieves the most relevant items from knowledge, memory, records and coding learning. This gives the manager a compact evidence prefix. If more evidence is required, the agent can call retrieval tools.

## Persistence

When Supabase is configured, all persistent state is server-side. Without Supabase, JSON files make local development functional.

## Tool execution

The model does not have direct database access. Every supported action is a typed tool. The tool implementation enforces validation, writes to the applicable store, and can write an audit record.

## Human approval

Sensitive tools set `needsApproval: true`. The Agents SDK pauses before execution. The UI shows the requested action, sends the user's decision back, and resumes the serialized `RunState`.

## Production next steps

Before production use:

- add authentication and organizational tenancy;
- add role-based RLS and permissions;
- encrypt/manage secrets through deployment infrastructure;
- add user/role identity to every memory, record and action;
- add retention rules and memory review/expiry;
- add semantic embedding retrieval if the knowledge corpus becomes materially larger;
- add approval roles (employee, supervisor, finance) instead of one generic approval control;
- add immutable finance approval/audit records;
- integrate payroll, accounting and donor-budget systems through explicit tools/MCP;
- add automated evaluations for tool correctness and control-policy compliance.
