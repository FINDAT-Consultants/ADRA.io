# Live Supabase Edge Function Inventory

Snapshot of the **Assurance Regent** Supabase project (`fubqwljypdiojpbdunjc`) reconciled to this repository on **2026-08-29**.

This manifest records every Edge Function that was active in the live project at reconciliation time. `supabase/config.toml` mirrors the live `verify_jwt` setting for each function. Function secrets and credentials are intentionally not stored in GitHub.

| Function | Live version | `verify_jwt` | GitHub source | Live deployment SHA-256 |
| --- | ---: | :---: | --- | --- |
| `assurance-regent-api` | 14 | false | `supabase/functions/assurance-regent-api/index.ts` | `234977525803ab5934c5130cb3153ded9427a94417259950ec8fc85f1a2f8658` |
| `recovery-agent` | 27 | false | `supabase/functions/recovery-agent/index.ts` | `a080f643d1c0642c05899c48fca45d48e7fd6740af23bfe1be72cf3881230e9d` |
| `voice-access` | 4 | true | `supabase/functions/voice-access/index.ts` | `0fc35e14a7358c1fabbf2a8601373e713b023f88aae8d93c4effdb58650a946b` |
| `recruitment-public` | 13 | false | `supabase/functions/recruitment-public/index.ts` | `79ba8df1ad3f58b56cf8af68a2c16e56b974b1ddc93da31b03929e6e3d153211` |
| `assurance-regent-files` | 4 | false | `supabase/functions/assurance-regent-files/index.ts` | `598dcffc447fd26ebeebb60b751a32364461f7150cb121bb5734f9e716d871ec` |
| `recruitment-ai-source-test` | 3 | true | `supabase/functions/recruitment-ai-source-test/index.ts` | `b6bdab87ab654d6d6c283b873c986c69028c4aa1c09367fd96acfb77b08fe81e` |
| `recruitment-ai-e2e-test` | 3 | true | `supabase/functions/recruitment-ai-e2e-test/index.ts` | `49a279d93572459025696ed22e705d0db66256cda58af00b4c6c0695308568ed` |
| `jivan-inbox-draft` | 2 | false | `supabase/functions/jivan-inbox-draft/index.ts` | `7010619b6466b35b003d985dfa3280ca50339ca436abf25ff813a6a1e46db5f8` |
| `jivan-inbox-ai` | 2 | false | `supabase/functions/jivan-inbox-ai/index.ts` | `83eb46bbe585e7009ebdeeaeb5237386b91b86da67b8675d86e15166554107f7` |
| `jivan-voice` | 6 | false | `supabase/functions/jivan-voice/index.ts` | `aa8adc4b28c77509e447aa2158147b6544b08502881090dc3ae82f9cdf96e2d9` |
| `assurance-regent-company-purge` | 2 | false | `supabase/functions/assurance-regent-company-purge/index.ts` | `06486deefe06ec83f7cfdf6e6b1f2a4ffcd754522033d830c08f69c5a3a47e82` |
| `jivan-response-style` | 2 | false | `supabase/functions/jivan-response-style/index.ts` | `e7c75fa20f52dcecf262751392e552875b3951d0b861cee2cc89efdd917810f1` |
| `department-hub-retention` | 2 | false | `supabase/functions/department-hub-retention/index.ts` | `99ac96308d8c0a8a8f46efc7578bc9393f1e3d5983066b6ef3b7e547d3908162` |
| `gmail-connector` | 5 | false | `supabase/functions/gmail-connector/index.ts` | `4a8d821ad5583995d0aba6641f9d3b8ace61e2ca4c9ecc500551d6bf923c7f67` |
| `meet-interview-assistant` | 4 | false | `supabase/functions/meet-interview-assistant/index.ts` | `5225f47db1f0f01b871b23e703bc96a528b63b40c5b0cddda6b473f6fa1d28ff` |
| `meet-media-connector` | 6 | false | `supabase/functions/meet-media-connector/index.ts` | `60e5a8de437535437fc82c07528d2a73340c3ee8e279aa1d949091204b6b1de1` |
| `zari-public-voice` | 4 | false | `supabase/functions/zari-public-voice/index.ts` | `3f46f76a34335bb80cd1006ec11b95d65d08ede9ca69e540be108b231efc573c` |
| `company-holidays` | 9 | false | `supabase/functions/company-holidays/index.ts` | `1cba3471c472c8e637b54e3fd0d2956dde735a26edcfcf5694d7df03b074407e` |

## Reconciliation contract

- Every function listed by the live project is represented under `supabase/functions/<slug>/`.
- `supabase/config.toml` is the repository deployment configuration and must stay aligned with live JWT verification settings.
- Retired/disabled endpoints remain represented while they are still deployed live, so the repository can reproduce and audit the live project accurately.
- Secrets such as API keys, OAuth client secrets, service-role credentials, and function environment variables remain in Supabase secrets/configuration and must never be committed.
