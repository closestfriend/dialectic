// One bounded raw search request; no workflow expansion or automatic retries.
const base = new URL(process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com");
if (base.protocol !== "https:" || !["hackathon.api.qloo.com", "api.qloo.com"].includes(base.hostname)) {
  throw new Error("Health check requires an official HTTPS Qloo endpoint");
}
if (!process.env.QLOO_API_KEY) throw new Error("QLOO_API_KEY is missing");
const url = new URL("/search", base);
url.search = new URLSearchParams({ query: "The Beatles", take: "1" });
try {
  const response = await fetch(url, {
    headers: { "X-Api-Key": process.env.QLOO_API_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`HTTP ${response.status}: response is not JSON`); }
  if (response.status !== 200) {
    // Keep arbitrary remote payloads and credentials out of logs.
    throw new Error(`HTTP ${response.status}; JSON error payload keys: ${Object.keys(body ?? {}).join(", ")}; no retry attempted`);
  }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    throw new Error("HTTP 200 but expected nonempty results array is missing");
  }
  console.log(JSON.stringify({ status: response.status, endpoint: url.origin + url.pathname,
    jsonParsed: true, resultCount: body.results.length,
    entity: { name: body.results[0].name, entity_id: body.results[0].entity_id } }, null, 2));
} catch (error) {
  console.error(`Qloo connection check failed: ${error.message}`);
  process.exitCode = 1;
}
