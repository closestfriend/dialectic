# DIALECTIC

**Two cultural worlds. A commission worth testing.**

## The problem

A collaboration often starts with two names and no credible shared project.
Creative directors, music supervisors, cultural programmers and partnership
teams need more than a clever mashup: they need references, an achievable
deliverable, and a reason to believe the pairing deserves a test.

## What we built

DIALECTIC is a commissioning instrument. Select two exact Qloo entities,
choose a collaboration, audience-introduction or programming goal, and receive
up to three draft directions drawn from measured cross-domain recommendations.

Each direction separates:

1. **Qloo observation:** the reference entity, normalized contributions from
   both seeds, joint affinity, and linked request evidence.
2. **Independent check:** whether that reference also appears in each seed's
   separate top-20 shortlist for its domain. Absence is reported as limited
   observation, never proof of no connection.
3. **Proposed commission:** a format-specific editorial starting point with a
   concrete deliverable, first action, creative constraints and rejection test.

The user can adjust the balance window, inspect excluded candidates, read the
investigation ledger, copy/download the brief, print it, or export source evidence.

## Why Qloo is essential

A language model can invent a story about any two names. DIALECTIC first needs
Qloo's returned entities and per-seed explainability scores to choose its references.
Without both seed scores and matching request provenance, a candidate cannot
anchor a brief. The creative proposal is visibly separate from this evidence.

Direct REST workflow:

- `/search`: resolve names to UUIDs and ask the user to confirm matches.
- `/v2/analysis/compare`: compare attached catalog tags using
  `a.signal.interests.entities` and `b.signal.interests.entities`.
- `/v2/insights`: explore movie, artist, book, place and brand with both UUIDs
  and `feature.explainability=true`.
- Up to six separate-seed insights queries: corroborate up to three selected
  references against the independent shortlists.

The solver normalizes scores `a/(a+b)` and `b/(a+b)`, minimizes the greatest
distance from 50%, and breaks ties by joint affinity. It diversifies the brief's
reference domains and excludes missing, malformed, lopsided or ungrounded entries.

## A real example

Aphex Twin (artist) × Martha Stewart (author) returned 100 candidates in the first
five-domain run. Seventy-eight met a 40–60% attribution window. Sleep No More was
one balanced reference, at approximately 50.1% / 49.9%.

The commissioning prototype selected Sleep No More, LFO and MasterClass as
references for an experience, a listening commission and a partnership concept.
The independent checks did **not** observe any of those references in both
separate top-20 lists. The interface therefore labels their support as needing
testing. It does not promote a plausible draft into a claim of proven demand.

This is the important reveal: a balanced joint recommendation and independent
shortlist corroboration answer different questions. The ledger keeps both visible.

## 90-second demo script

**0–15 seconds:** “Two names are easy. A credible collaboration is harder.”
Choose the Aphex Twin × Martha Stewart preset, then confirm artist and author.

**15–35 seconds:** Build the commissioning brief. Show the three references and
the concrete deliverable in one direction. Point out that the proposal is an
editorial starting point, while the attribution comes from Qloo.

**35–55 seconds:** Open the ledger. Show how the independent checks qualify the
initial result. “The tool shows what supports the idea and what still needs a test.”

**55–75 seconds:** Narrow the balance window to 50–50 and rebuild. Show the empty
state rather than fabricated replacement references. Restore 40–60% and rebuild.

**75–90 seconds:** Download the Markdown brief. “This is something a creative
team can hand to a producer, develop, and reject intelligently.”

## Reproducibility and verification

Node.js >=22.19.0. Configure a private `.env` using `.env.example`, then:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4317`. Run `npm test` for the contract tests.
`npm run verify:browser` additionally uses an installed Chrome browser; set
`CHROME_PATH` if its executable differs from the documented macOS default.

Optional local MLflow tracing and native evaluation are documented in
[the prototype guide](../app/README.md). Six synthetic fixtures passed checks
for reference grounding, uncertainty, handoff completeness and request budget.
This evaluation does not measure originality or commercial viability.

## Known limits

- Scores describe recommendation attribution, not shared-audience size, causality,
  individual preferences, ticket sales or purchase intent.
- The search examines top-20 results per domain, not every node in Qloo's graph.
- Independent shortlist absence remains inconclusive. Cross-query affinity
  values are not treated as comparable measurements.
- Editorial directions use transparent format-specific templates. There is no
  LLM planner or generated claim of creative validation.
- No location/popularity filtering, live availability checks or rights clearance.
- The local backend has a shared 250 ms queue, cache and no automatic retries.
  Multiple server processes would need a shared credential-wide limiter.
- Hosted on Vercel at https://dialectic-zeta.vercel.app. The Qloo credential
  remains server-only; MLflow is optional and is not required by the hosted app.
- API pacing and caches are per function instance; multiple instances do not
  share a credential-wide queue.

## Source repository

Public source: https://github.com/closestfriend/dialectic.
The repository includes source, screenshots, setup instructions and an MIT license.
Secrets, dependencies and local MLflow state are excluded.

## Demo materials

- [Desktop commissioning view](./dialectic-commissioning-desktop.png)
- [Desktop landing view](./dialectic-home-desktop.png)
- [Mobile direction](./dialectic-commissioning-mobile.png)
- [Downloaded live commissioning brief](./dialectic-demo-brief.md)
