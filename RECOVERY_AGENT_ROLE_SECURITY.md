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
| Arbitrary JavaScript / raw SQL from model | No | No | No |
| Destructive/security actions without dedicated approval tool | No | No | No |

## Defense in depth

1. **Server-side context scoping:** the Edge Function filters organizational data before the OpenAI request is built.
2. **Tool schema scoping:** OpenAI is only offered navigation/control tools appropriate to the signed-in role.
3. **Browser permission recheck:** returned UI commands are checked against Assurance Regent permissions before execution.
4. **Audit:** commands, tool authorization, voice events, responses and failures are recorded through session-validated Supabase RPCs.
5. **No browser API secret:** the OpenAI key remains in Supabase Edge Function Secrets.
