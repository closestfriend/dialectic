# DIALECTIC

A local commissioning prototype using direct Qloo REST calls. No model API key
is needed. The official harness and MCP starter remain available separately.
MLflow tracing is an optional local backend integration; Playwright is a development
dependency used for repeatable browser checks and screenshots.

## Run

From the repository root, with the private `.env` configured:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4317**. Use `PORT=4318 npm run dev` if that port is busy.
The server binds only to loopback. Keep the terminal running; Ctrl-C stops it.

1. Search for the Thesis and Antithesis. Select an exact result on each side.
2. Choose a project goal, then click **Build commissioning brief**. One catalog
   comparison and five domain requests run through a shared queue; request starts
   are at least 250 ms apart. Up to six follow-up calls check selected references
   against separate seed shortlists before the brief appears.
3. Adjust the balance window or domain. These controls use the returned data
   and make no further Qloo requests. Show excluded candidates to inspect misses.
4. Inspect the three proposed directions and ledger. Copy/download the Markdown
   brief or print it. Open **Why this result?** in the explorer for raw scores, or
   export the full collision evidence as JSON. The Markdown includes follow-up evidence.

Goal or balance-window changes hide the previous brief until it is rebuilt.
Seed changes clear it. The reference shortlist is evidence; format-specific
editorial proposals are visibly labeled, with deliverables, next steps and rejection
criteria. Missing evidence yields fewer directions or explicit abstention.

## Optional local tracing and quality evaluation

```sh
uv venv .venv-eval --python 3.12
uv pip install --python .venv-eval/bin/python mlflow==3.17.2
mkdir -p .local/mlflow
npm run mlflow:server
# In another terminal, while the collector is running:
npm run mlflow:setup
# Restart the application so it loads the new environment settings.
npm run dev
npm run eval:brief
```

The collector binds to `127.0.0.1:5001` and stores SQLite/artifacts under ignored
`.local/`. HTTP-served `mlflow-artifacts:/` locations are required for the JS SDK.
Tracing records explicit public entity/parameter summaries, never API headers or
credentials. It is disabled if its environment settings are absent. The app's
in-product ledger remains available without MLflow.

Evaluation discovers/reuses a native MLflow dataset, runs a three-fixture dry run,
then six offline fixtures through `mlflow.genai.evaluate`. The four repository-owned
code scorers check grounding, uncertainty, handoff fields and the six-request budget.
Custom scorer deserialization remains disabled on the server. Synthetic fixtures
verify contracts, not the creative quality of the directions or market demand.
Results are available in the MLflow UI and `.local/brief-evaluation.json`.

Run `npm run verify:browser` to verify actual Markdown download, invalidation,
empty state, mobile overflow and print view in isolated Chrome. The default
executable is the macOS Chrome app; override with `CHROME_PATH` on other systems.

## What is measured

The prototype reads each candidate's
`query.explainability["signal.interests.entities"]` entries by seed UUID.
For finite nonnegative scores `a` and `b`, with `a+b>0`:

```text
shareA = a / (a + b)
shareB = b / (a + b)
distance = max(abs(shareA - 0.5), abs(shareB - 0.5))
```

Results sort by smallest distance, then highest joint affinity. The default
window accepts shares from 40% to 60%. Missing, duplicate, invalid and zero-total
scores are unverified and excluded by default. Attribution is not audience size,
a causal explanation, or a probability about an individual. The solver finds the
best balance **within the top 20 candidates returned per domain**, not a global
optimum over Qloo's entire graph. There is no minimum-affinity cutoff; affinity
is displayed so users can assess strength separately from balance.

`/v2/analysis/compare` takes `a.signal.interests.entities` and
`b.signal.interests.entities`. Its returned shared catalog tags are displayed
separately. They do not establish shared audience membership. Candidate images,
descriptions and identifying metadata are returned by Qloo and can be incomplete
or inaccurate; DIALECTIC does not generate these descriptions.

## Operational behavior

- Backend-only API key, explicit official endpoint allowlist, no credential in
  requests from the browser. Only the four allowlisted public assets are served.
- One shared serialized HTTP queue per process. Do not start multiple copies
  against the same credential if you need a credential-wide rate guarantee.
- In-memory 30-minute cache, 250-entry limit, SHA-256 keys from path plus sorted
  parameters, and in-flight deduplication. Restarting clears it.
- 20-second timeout per upstream request, no automatic retry, and bounded
  `Retry-After` cooldown on 429. A domain failure preserves the other domains.
- One collision at a time, at most four pending search requests. Confirmed
  search IDs expire after one hour; search again after a server restart.
- No location or popularity filtering yet. Those need parameter-effect tests
  with representative fixtures before adding them to the UI.
- No LLM planner: the investigation is a deterministic, inspectable tool chain.
  Proposed commissions use disclosed editorial templates. Qloo does not write or
  validate them.

## Code map

| File | Responsibility |
| --- | --- |
| [balance.mjs](./balance.mjs) | Attribution validation and minimax ranking |
| [qloo.mjs](./qloo.mjs) | Parameter allowlist, pacing, caching, timeout and errors |
| [server.mjs](./server.mjs) | Local API, entity confirmation, orchestration and static assets |
| [brief.mjs](./brief.mjs) | Reference selection, independent checks and editorial handoff |
| [tracing.mjs](./tracing.mjs) | Optional MLflow spans with explicitly selected public inputs |
| [public/](./public/) | Responsive browser interface |

## Verification

```sh
npm test
```

Thirteen automated tests passed covering balance validity and ranking,
cache/deduplication, pacing/failure recovery, parameter rejection, confirmed
entities, partial failures, origin rejection and private-file exclusion.

Live browser verification on October 29, 2026: Aphex Twin (artist) × Martha
Stewart (author) returned 100 candidates across all five domains in 2.1 seconds;
78 fell within 40–60%. Sleep No More ranked first at approximately 50.1% / 49.9%.
A repeat collision was entirely cached. Tested domain filtering, excluded
candidates, zero-width empty state, raw evidence, stale-result invalidation,
and page width at 390 px and 1440 px. The source JSON includes the independent
request evidence after a brief is built. Headless Chrome verified a real Markdown
download to disk, empty-state rebuilding, goal/window invalidation and print view;
there were no page errors. The integrated-browser regression also verified that
an intentionally failed brief cannot expose a prior pair's Markdown draft.

Final review added malformed-entry isolation and strict monotonic-deadline
pacing. Both findings are covered by the passing regression suite.

The commissioning review fixed stale Markdown exposure after invalidation. Native
MLflow evaluation passed four code checks across six offline fixtures. A live JS
commissioning trace was read back with seven spans (root plus six Qloo checks).

The [submission package](../docs/SUBMISSION_DIALECTIC.md) includes the product
description, demo script, verified live example and screenshot links.

Existing tooling limitations and npm advisories are recorded in
[LOCAL_SETUP.md](../LOCAL_SETUP.md). This local prototype is not deployed.
