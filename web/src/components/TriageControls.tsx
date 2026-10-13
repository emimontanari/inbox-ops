import { useState } from "react";
import type { ApiClient } from "../api.js";

type Feedback = { kind: "status" | "error"; text: string };

// Triage is a deliberate action: it spends provider tokens, so it never runs on page load.
export function TriageControls(props: { api: ApiClient; pending: number; failed: number; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | undefined>();

  async function run(options: { retryFailed?: boolean }) {
    setRunning(true);
    setFeedback(undefined);
    try {
      const outcome = await props.api.triage(options);
      setFeedback({ kind: "status", text: `Triaged ${outcome.triaged}, failed ${outcome.failed}.` });
      props.onDone();
    } catch {
      setFeedback({ kind: "error", text: "Triage could not run. Is the API running?" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={running || props.pending === 0}
        onClick={() => void run({})}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {running ? "Triaging…" : "Run triage"}
      </button>
      <button
        type="button"
        disabled={running || props.failed === 0}
        onClick={() => void run({ retryFailed: true })}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        Retry failed
      </button>
      <span className="text-xs text-slate-500">
        {props.pending} new · {props.failed} failed
      </span>
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-slate-700"}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
