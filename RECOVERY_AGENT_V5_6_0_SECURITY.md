# Recovery Agent v5.6 — Operations & External Research Security

- **Profile:** Any signed-in user may open and save their own permitted profile fields.
- **Settings:** Saving remains governed by the existing Settings permission model.
- **Sign out:** Requires an explicit current user instruction containing sign out/log out/logout.
- **Local files:** Recovery Agent may initiate a chooser, but the user selects the local file. The application does not enumerate arbitrary local files or folders.
- **Document workflow:** A file selected after an Agent-initiated Control Center upload is automatically submitted to the existing document review workflow; document upload is not document approval.
- **Public web research:** Uses OpenAI web search from the Supabase Edge Function. Search queries must not contain credentials, tokens, private HR/payroll/banking data, or private document content. External findings are kept distinct from stored Assurance Regent records.
- **Developer governance:** Existing v5.5 exact-target Developer tools and confirmations remain in force.
