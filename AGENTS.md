# Web PepChat Codex instructions

## Local browser QA first

Always start browser QA and UI verification against the local development
server. Use the dev environment for the normal inspect, change, and retest loop;
do not run a production build or deploy merely to verify ordinary layout,
interaction, authentication, cart, or checkout changes.

Run a production build or live-host check only when the behavior specifically
depends on production bundling or infrastructure, such as lazy hashed chunks,
service workers and caches, response headers, release routing, or deployment
timing. Even in those cases, iterate locally first and use the production check
only as the final targeted verification.
