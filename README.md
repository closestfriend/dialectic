# DIALECTIC

A commissioning application for the Qloo hackathon: collide two confirmed
entities (thesis / antithesis) and discover recommendations across five domains
using direct Qloo REST calls, with measured attribution — no model API key, no
invented bridges. The interface is dependency-free and served by a loopback-only
Node backend that owns credentials.

Live demo: **https://dialectic-zeta.vercel.app**

Hosted on Vercel in the closestfriend Pro team. The Qloo API key is a private
production environment variable. Signed selection and evidence tokens preserve
the workflow across serverless cold starts. MLflow is optional for local evaluation.

## Run

From the repository root, with a private `.env` configured (`QLOO_API_KEY`,
`QLOO_BASE_URL` — see the guide):

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4317**. Use `PORT=4318 npm run dev` if that port is
busy. The server binds only to loopback; `Ctrl-C` stops it.

1. Search for the Thesis and Antithesis. Select an exact result on each side.
2. Choose a project goal, then click **Build commissioning brief**. One catalog
   comparison and five domain requests run through a shared queue; request
   starts are at least 250 ms apart.
3. Adjust the balance window or domain — these filters use returned data and
   make no further Qloo requests.
4. Inspect the proposed directions, ledger and raw evidence. Export collision
   evidence as JSON or the brief as Markdown.

## Documentation

- [Prototype guide](app/README.md) — full setup, tracing, evaluation, limits.
- [Submission package](docs/SUBMISSION_DIALECTIC.md)
- [Demo brief](docs/dialectic-demo-brief.md)
- [Implementation plan](docs/superpowers/plans/2026-10-29-dialectic.md)
- Screenshots: [home](docs/dialectic-home-desktop.png),
  [commissioning (desktop)](docs/dialectic-commissioning-desktop.png),
  [commissioning (mobile)](docs/dialectic-commissioning-mobile.png)

## Tests

```sh
npm test
```

Thirteen Node tests cover attribution ranking, balancing, the Qloo client
(cache, pacing, coalescing) and the server; browser checks live in
`scripts/verify-browser.mjs`.

Note: an npm audit of the pinned dependency tree reports 28 transitive
advisories (22 moderate, six high, via the tracing SDK's OpenTelemetry tree and
the official harness's undici dependency). Compatible `npm audit fix` did not
resolve them. The hosted demo exposes only the application's restricted Qloo
routes; dependency updates remain a follow-up task.
