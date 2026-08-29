Assurance Regent v6.3.129 — Developer registered-country change

What changed
- The Developer can open Edit company details, click Registered country, select another country, and save it.
- A country change requires confirmation.
- The previous/new country and ISO-2 codes are recorded in registrationHistory.
- registeredCountry/registeredCountryCode and compatibility country/countryCode fields are updated together.
- The company public-holiday context refreshes after a successful country change.
- Administrator/Employee permissions are unchanged; this correction remains Developer-only.

Existing Supabase project
Run: supabase/migrations/20260824213000_developer_registration_country_change_v6_3_129.sql
(or the root copy DEVELOPER_REGISTRATION_COUNTRY_CHANGE_V6_3_129.sql) in the Supabase SQL editor / normal migration workflow.

Fresh project
The consolidated setup SQL files in this package were also updated so they no longer enforce the old immutable-country rule.
