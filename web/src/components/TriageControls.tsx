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
      setFeedback({ kind: "status", text: `Clasificadas: ${outcome.triaged}; fallidas: ${outcome.failed}.` });
      props.onDone();
    } catch {
      setFeedback({ kind: "error", text: "No se pudo ejecutar la clasificación. ¿Está en marcha la API?" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p id="triage-scope" className="w-full text-sm">Pendientes de toda la bandeja: Clasificar procesa todas las solicitudes nuevas; Reintentar fallidas incluye nuevas y fallidas. Los filtros no limitan el alcance. Ambas acciones envían mensajes a Groq y consumen tokens.</p>
      <button
        type="button"
        aria-describedby="triage-scope"
        disabled={running || props.pending === 0}
        onClick={() => void run({})}
        className="action-primary"
      >
        {running ? "Clasificando…" : "Clasificar"}
      </button>
      <button
        type="button"
        aria-describedby="triage-scope"
        disabled={running || props.failed === 0}
        onClick={() => void run({ retryFailed: true })}
        className="action-secondary"
      >
        Reintentar fallidas
      </button>
      <span className="text-xs text-slate-500">
        {props.pending} nuevas · {props.failed} fallidas
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
