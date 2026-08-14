# Recovery Agent v5.7.0 — Voice, Location & External-Service Security

## Microphone
Browser microphone permission is a browser/OS privacy boundary and cannot be bypassed by application JavaScript. Assurance Regent only invokes `getUserMedia()` when the user starts a recording. Once permission is already granted to the deployed HTTPS origin, subsequent recordings can start directly subject to browser policy.

Recorded audio is transcribed and the transcript is submitted directly to Recovery Agent. It is not staged in the visible prompt field first.

## Stop Speaking
The floating operator includes a dedicated Stop Speaking control. It cancels both `speechSynthesis` playback and generated audio playback without deleting the written response.

## Location
The Agent only reads device coordinates when the browser permission state is already `granted`. It does not trigger a silent location permission request. If device location is unavailable, the application may provide the user's stored work-location label as a fallback. The AI is instructed not to misrepresent this fallback as exact current location.

## Public web research
Public web search must not include private payroll, HR records, banking information, credentials, access tokens, or confidential document contents. Public contact details should come from reputable public sources.

## Research artifacts
Research visualizations may only use numeric values established by the research. The AI must not fabricate missing values. Word/PDF/TXT research documents are generated client-side from the approved research content.

## Food/local-service handoff
Food search is allowed as public local research. The Agent may not place purchases autonomously. A food-order handoff requires:

1. An explicit current instruction to order/buy/deliver food.
2. A secure HTTPS merchant URL.
3. A user confirmation before the external merchant page opens.

Assurance Regent does not expose stored HR/payroll/banking data to merchants and does not contain a universal payment/checkout integration in v5.7.0.
