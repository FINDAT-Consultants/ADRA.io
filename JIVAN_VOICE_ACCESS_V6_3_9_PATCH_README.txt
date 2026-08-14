Assurance Regent v6.3.9 — Jivan Voice Access

Implemented:
- Small centered sign-in microphone with animated sound wavelength.
- Split Jivan voice chooser: Instruction / Recognize voice.
- Voice instruction transcription for username/email/employee ID and role assistance.
- Spoken passwords are not captured or populated; Jivan directs users to voice recognition or private password entry.
- Voice-recognition account access with one-time challenge phrase and speaker-template matching.
- Registration voice-enrollment section with three short samples.
- Private Supabase Storage bucket for enrollment WAV samples.
- Private voice-profile, challenge and audit tables protected from anon/authenticated browser roles.
- New Supabase voice-access Edge Function and migration/verification scripts.
- Approved/account/company access checks are applied before a voice-verified browser session is issued.
