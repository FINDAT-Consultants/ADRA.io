ASSURANCE REGENT v6.3.17

Profile persistence repair release.

Primary fix:
The Profile panel no longer attempts to mutate control.profile.currentUser in a persisted control object that may not contain a profile object. Profile saves now go through a dedicated session-governed Supabase RPC and persist display name, email and optimized profile picture.

Existing Supabase database:
Run PROFILE_PERSISTENCE_V6_3_17.sql, then deploy /public.

Fresh Supabase database:
Run ASSURANCE_REGENT_SUPABASE_SETUP_V6_3_17.sql, then deploy /public.

Public application asset:
app.0c811916eab0.js

See PROFILE_PERSISTENCE_V6_3_17_DEPLOYMENT_GUIDE.txt.
