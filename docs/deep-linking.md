# Zeko deep-link contract

Zeko publishes HTTPS links on `peptide.chat` and accepts `app.peptide.chat` as
a compatibility host. Both hosts must serve the same Apple App Site Association
and Android Asset Links declarations without redirects.

Supported paths:

- `/invite/{code}`
- `/channel/{channelId}` and `/channel/{channelId}/{messageId}`
- `/server/{serverId}`
- `/server/{serverId}/channel/{channelId}`
- `/server/{serverId}/channel/{channelId}/{messageId}`

Clients must retain a valid destination while login, onboarding, or Ready/API
hydration completes. An inaccessible channel or missing message must produce an
explicit unavailable state. New links must use `https://peptide.chat`; legacy
plural Android paths are accepted only for backwards compatibility.
