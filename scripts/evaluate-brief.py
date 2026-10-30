"""Native MLflow evaluation of the deterministic brief's evidence contract.

Uses the dataset/merge/evaluate/scorer pattern in the agent-evaluation skill
templates. Fixtures test behavior; human review still judges creative usefulness.
No Qloo or model calls are made. Credentials are excluded from the Node subprocess.
"""
import json
import os
from pathlib import Path
import subprocess
import time

os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")
os.environ.setdefault("MLFLOW_USAGE_STATS_ENABLED", "false")
os.environ.setdefault("MLFLOW_GENAI_EVAL_MAX_WORKERS", "1")
from dotenv import load_dotenv
import mlflow
from mlflow.genai.scorers import scorer
from mlflow.tracking import MlflowClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
mlflow.set_tracking_uri(os.environ["MLFLOW_TRACKING_URI"])
experiment_id = os.environ["MLFLOW_EXPERIMENT_ID"]
mlflow.set_experiment(experiment_id=experiment_id)
scenarios = ["balanced", "lopsided", "malformed", "missing-provenance", "check-failure", "not-observed"]
abstain = {"lopsided", "malformed", "missing-provenance"}
records = [{"inputs": {"scenario": name}, "expectations": {
    "direction_count": 0 if name in abstain else 3,
    "allowed_anchors": [] if name in abstain else ["ref-place", "ref-artist", "ref-brand"],
    "check_status": {"check-failure": "incomplete", "not-observed": "needs_testing"}.get(name, "seen_in_both"),
}} for name in scenarios]

@mlflow.trace(name="DIALECTIC offline commissioning evaluation")
def predict(scenario):
    safe_env = {k: v for k, v in os.environ.items() if k not in {"QLOO_API_KEY"}}
    result = subprocess.run(["node", "scripts/brief-fixture.mjs"], cwd=ROOT, env=safe_env,
                            input=json.dumps({"scenario": scenario}), text=True, capture_output=True,
                            check=True, timeout=10)
    return json.loads(result.stdout)

@scorer
def references_grounded(outputs, expectations):
    allowed = set(expectations["allowed_anchors"])
    return all(d["anchor"]["entity_id"] in allowed and d["observation"]["evidenceIds"]
               for d in outputs["directions"])

@scorer
def uncertainty_preserved(outputs, expectations):
    return (len(outputs["directions"]) == expectations["direction_count"]
            and all(d["check"]["status"] == expectations["check_status"] for d in outputs["directions"]))

@scorer
def commissioning_handoff_complete(outputs, expectations):
    if expectations["direction_count"] == 0:
        return outputs["status"] == "insufficient_evidence" and not outputs["directions"]
    return len(outputs["directions"]) == 3 and all(
        d["proposal"]["deliverable"] and d["proposal"]["nextStep"] and d["proposal"]["rejectIf"]
        and d["proposal"]["kind"] == "editorial_proposal" for d in outputs["directions"])

@scorer
def request_budget_respected(outputs):
    return outputs["fixtureRequests"] <= 6

def main():
    started = time.monotonic()
    client = MlflowClient()
    # Discover before creating, and reuse the named local dataset.
    existing = mlflow.genai.datasets.search_datasets(experiment_ids=[experiment_id], max_results=100)
    dataset = next((d for d in existing if d.name == "dialectic-commissioning-v1"), None)
    if dataset is None:
        dataset = mlflow.genai.datasets.create_dataset(name="dialectic-commissioning-v1", experiment_id=experiment_id)
    dataset.merge_records(records)
    checks = [references_grounded, uncertainty_preserved, commissioning_handoff_complete, request_budget_respected]
    # Custom scorer registration is disabled on an untrusted OSS server by default.
    # Keep this executable scorer code in the repository and pass it directly to
    # native evaluation, rather than enabling remote scorer deserialization.
    # Trace readback is bounded by the subprocess/HTTP timeout and only one trace is read.
    predict("balanced")
    trace_id = mlflow.get_last_active_trace_id()
    print(f"Trace ID: {trace_id}", flush=True)
    print("Starting trace readback", flush=True)
    mlflow.flush_trace_async_logging()
    trace = mlflow.get_trace(trace_id)
    if not trace or not trace.data.spans:
        raise RuntimeError("Tracing could not be verified; evaluation stopped")
    print("Dry run: 3 fixtures; four deterministic quality checks. No paid model calls.", flush=True)
    dry = mlflow.genai.evaluate(data=dataset.to_df().head(3), predict_fn=predict, scorers=checks)
    dry_metrics = client.get_run(dry.run_id).data.metrics
    relevant = {k: v for k, v in dry_metrics.items() if k.endswith("/mean")}
    if not relevant or any(v != 1.0 for v in relevant.values()):
        raise RuntimeError(f"Dry run did not pass: {relevant}")
    print("Dry run passed. Proceeding to six-fixture evaluation.", flush=True)
    full = mlflow.genai.evaluate(data=dataset, predict_fn=predict, scorers=checks)
    metrics = client.get_run(full.run_id).data.metrics
    summary = {"run_id": full.run_id, "dataset_id": dataset.dataset_id, "fixtures": len(records),
               "metrics": metrics, "seconds": round(time.monotonic() - started, 2),
               "limits": "Synthetic offline contract checks, not a measure of originality, demand or human creative quality."}
    destination = ROOT / ".local" / "brief-evaluation.json"
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    scored = {k: v for k, v in metrics.items() if k.endswith("/mean")}
    if not scored or any(v != 1.0 for v in scored.values()):
        raise RuntimeError("Evaluation found a regression")

if __name__ == "__main__":
    main()
