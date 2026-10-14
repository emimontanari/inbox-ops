import { useState } from "react";
import type { ReplyDraft } from "../../../src/domain/reply-draft.js";
import { ApiError, type ApiClient } from "../api.js";

const ERROR_MESSAGE: Record<string, string> = {
  drafter_unavailable: "El servicio de IA no está disponible. Inténtalo de nuevo más tarde.",
  drafter_invalid_output: "La IA devolvió un borrador inválido o con fuentes desconocidas. Puedes generarlo de nuevo.",
  not_draftable: "Clasifica la solicitud antes de generar un borrador.",
  not_found: "Esta solicitud ya no existe. Recarga la lista.",
};

// Suggests a reply for a person to edit and copy. InboxOps never sends it.
export function ReplyDraftPanel(props: { ticketId: string; api: ApiClient; disabled?: boolean }) {
  const [draft, setDraft] = useState<ReplyDraft | undefined>();
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState<"done" | "failed" | undefined>();

  async function generate() {
    setGenerating(true);
    setError(undefined);
    setCopied(undefined);
    try {
      const next = await props.api.draftReply(props.ticketId);
      setDraft(next);
      setText(next.sentences.map((sentence) => sentence.text).join(" "));
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : undefined;
      setError((code && ERROR_MESSAGE[code]) ?? "No se pudo generar el borrador. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  // Number sources in the order the server listed them, so footnotes and the list match.
  const number = new Map(draft?.sources.map((source, index) => [source.id, index + 1]));
  const title = new Map(draft?.sources.map((source) => [source.id, source.title]));

  return (
    <section aria-label="Borrador de respuesta" className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold">Borrador de respuesta</h2>
      <p className="text-xs text-slate-600">
        Genera una propuesta basada en las políticas de la tienda. Consume tokens del proveedor y nunca se envía al cliente.
      </p>
      <div className="review-actions">
        <button type="button" className="action-secondary" disabled={generating || props.disabled === true} onClick={() => void generate()}>
          {generating ? "Generando…" : draft ? "Generar otro borrador" : "Generar borrador"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {draft && (
        <>
          <h3 id="draft-sentences" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Respaldo de cada frase</h3>
          <ol aria-labelledby="draft-sentences" className="flex flex-col gap-2 text-sm">
            {draft.sentences.map((sentence, index) => (
              <li key={index} className="rounded-md bg-slate-50 p-2">
                <p>{sentence.text}</p>
                <p className={`mt-1 text-xs ${sentence.sourceIds.length > 0 ? "text-indigo-700" : "text-amber-700"}`}>
                  {sentence.sourceIds.length === 0
                    ? "Sin política citada: revísala antes de enviar."
                    : `${sentence.sourceIds.length === 1 ? "Fuente" : "Fuentes"} ${[...sentence.sourceIds]
                        .sort((a, b) => (number.get(a) ?? 0) - (number.get(b) ?? 0))
                        .map((id) => `[${number.get(id)}] ${title.get(id)}`)
                        .join(" · ")}`}
                </p>
              </li>
            ))}
          </ol>

          {draft.sources.length > 0 && (
            <>
              <h3 id="draft-sources" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Políticas citadas</h3>
              <ol aria-labelledby="draft-sources" className="flex flex-col gap-2 text-sm">
                {draft.sources.map((source) => (
                  <li key={source.id}>
                    <p className="font-medium">[{number.get(source.id)}] {source.title}</p>
                    <blockquote className="mt-1 border-l-2 border-indigo-200 pl-2 text-slate-600">{source.text}</blockquote>
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
            Las fuentes muestran qué política usó la IA, pero no garantizan que la respuesta sea correcta. Revísala y edítala antes de enviarla por tu canal habitual.
          </p>

          <label htmlFor="draft-text" className="text-xs font-medium text-slate-600">Texto para enviar</label>
          <textarea
            id="draft-text"
            value={text}
            rows={5}
            onChange={(event) => { setText(event.target.value); setCopied(undefined); }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <div className="review-actions">
            <button type="button" className="action-primary" disabled={text.trim() === ""} onClick={() => void copy()}>
              Copiar texto
            </button>
          </div>
          {copied === "done" && <p role="status" className="text-xs text-emerald-700">Texto copiado. Pégalo en tu canal de respuesta.</p>}
          {copied === "failed" && (
            <p role="alert" className="text-xs text-red-800">No se pudo copiar. Selecciona el texto y cópialo manualmente.</p>
          )}
        </>
      )}
    </section>
  );
}
