# Recovery Agent v5 — role and privacy boundaries

| Capability | Developer AI | Administrator AI | Employee AI |
|---|---|---|---|
| AI complexity | Advanced system | Advanced company | Guarded/simple |
| Data scope sent to OpenAI | System / companies | Own company only | Primarily own records |
| Dashboard / work / time / calendar | Yes | Yes | Yes |
| Payroll / recruiting / checks / voucher | Yes | Yes, own company | No |
| Company administration guidance | Yes | Own company | No |
| Developer authority | Yes | No | No |
| Cross-company context | Yes | No | No |
| Voice command and spoken reply | Yes | Yes | Yes |
| Proactive greetings / notification awareness | Yes | Yes | Yes |
| Form & dropdown population | All permitted pages | Own-company permitted pages | Personal/limited pages only |
| Stored-document review | System scope | Own company | Own permitted documents |
| Data exports | System / role-scoped | Own company | Personal/limited only |
| Document approval by AI inference | No | No | No |
| Explicit authorized approval command | Guarded | Guarded | No |
| Arbitrary JavaScript / raw SQL from model | No | No | No |
| Destructive/security actions without dedicated approval tool | No | No | No |

## Defense in depth

1. **Server-side context scoping:** the Edge Function filters organizational data before the OpenAI request is built.
2. **Tool schema scoping:** OpenAI is only offered navigation/control tools appropriate to the signed-in role.
3. **Browser permission recheck:** returned UI commands are checked against Assurance Regent permissions and the currently visible registered controls before execution.
4. **Audit:** commands, tool authorization, voice events, responses and failures are recorded through session-validated Supabase RPCs.
5. **No browser API secret:** the OpenAI key remains in Supabase Edge Function Secrets.

6. **Sensitive-action intent check:** approval/rejection/destructive controls require explicit authorization in the current user instruction; destructive/privilege actions retain a browser confirmation.
7. **Multi-step ceiling:** one instruction is limited to six interface continuation steps before the agent pauses and asks the user to continue.
8. **Document boundary:** document analysis may extract and suggest fields but never counts as document approval.
