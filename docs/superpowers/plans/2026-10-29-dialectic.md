# DIALECTIC prototype implementation plan

**Goal:** Discover cultural recommendations with measurable contributions from two confirmed Qloo entities.

**Architecture:** A loopback-only Node server owns credentials and a shared, paced, cached REST client. A dependency-free browser interface resolves entities, submits their UUIDs, and filters measured attribution locally. No LLM invents bridges or explanations.

**Approved scope:** Entity confirmation; movie, artist, book, place, brand exploration; default 40–60% attribution threshold; adjustable strictness; inspectable source evidence. Compare catalog tags are distinct from audience overlap. Empty and partial results remain explicit.

**Design:** Pale blue #edf2fa canvas, cobalt #234de1 thesis, coral #ce4b39 antithesis, navy #17253c text, white #ffffff surfaces. System sans UI with Georgia for the collision statement. A split input field converges on a centered collision control; results use a wide featured row and compact evidence cards. Color always accompanies text labels.

**Constraints:** Node >=22.19; secrets backend-only; starts >=250 ms apart; cache by sorted parameters with in-flight deduplication; bounded request timeout; no automatic retry; IDs confirmed by search; no fabricated balance if attribution is absent. No global installation, repository deletion, deployment, or Git changes.

## Tasks

- [x] Test attribution ranking: missing, malformed, zero, duplicate and lopsided signals cannot qualify; exact seed IDs determine the normalized pair share.
- [x] Build `app/balance.mjs`: minimize maximum distance from 0.5, breaking ties by joint affinity; preserve raw source scores.
- [x] Test and build `app/qloo.mjs`: cache, in-flight coalescing, 250 ms pacing, failure recovery; only allow known API parameter sets.
- [x] Build `app/server.mjs`: bounded same-origin requests, search confirmation tokens, collision orchestration, per-domain failures and evidence; static public files only.
- [x] Build `app/public/`: responsive entity selection, pair presets, threshold and domain filters, provenance, loading/errors/empty states, result evidence and JSON export.
- [x] Run Node tests, real API collision, browser desktop/mobile and keyboard checks. Document start commands and known limits.

## Final verification ledger

Eight automated tests pass. Live five-domain collision and cached repeat pass.
Browser filters, exact-balance empty state, excluded candidates, raw evidence,
stale-result invalidation and 390/1440 px overflow checks pass. Export content
verified; integrated-browser download completion not observable. Review fixed
malformed attribution crashes and timer rounding with regression coverage.
No Git commit was attempted because system Command Line Tools are unavailable.

## Review focus

Ambiguous search matches must be selected explicitly. Missing attribution must never become 50/50. Identical seeds must be rejected. A single domain failure must preserve other results. Changing a seed must invalidate prior selection and hide stale collision output. Place search context is not evidence of audience locality. The prototype has no location filter until a separate filter-effect check supports that feature.
