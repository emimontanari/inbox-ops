import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReplyDraft } from "../../src/domain/reply-draft.js";
import { ApiError } from "../src/api.js";
import { ReplyDraftPanel } from "../src/components/ReplyDraftPanel.js";
import { fakeApi } from "./fake-api.js";

const draft: ReplyDraft = {
  sentences: [
    { text: "Gracias por escribirnos.", sourceIds: [] },
    { text: "Para iniciar la devolución necesitamos el motivo.", sourceIds: ["returns-window"] },
    { text: "El reembolso se acredita en hasta 10 días hábiles.", sourceIds: ["returns-refund-timing", "returns-window"] },
  ],
  sources: [
    { id: "returns-window", title: "Devoluciones", topics: ["returns"], text: "Necesitamos el número de pedido y el motivo de la devolución." },
    { id: "returns-refund-timing", title: "Plazo de reembolso", topics: ["returns"], text: "Se acredita dentro de los 10 días hábiles." },
  ],
};

function clipboard(writeText = vi.fn(async (_text: string) => {})) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("ReplyDraftPanel", () => {
  it("never calls the model until the person asks, and says nothing is sent", () => {
    const draftReply = vi.fn();
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply })} />);

    expect(draftReply).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Generar borrador" })).toBeEnabled();
    expect(screen.getByText(/Consume tokens del proveedor y nunca se envía al cliente/)).toBeInTheDocument();
  });

  it("shows each sentence with its numbered sources and flags sentences without a source", async () => {
    const draftReply = vi.fn(async () => draft);
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply })} />);

    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));

    expect(draftReply).toHaveBeenCalledExactlyOnceWith("t-1");
    const sentences = within(await screen.findByRole("list", { name: "Respaldo de cada frase" })).getAllByRole("listitem");
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toHaveTextContent("Gracias por escribirnos.");
    expect(sentences[0]).toHaveTextContent("Sin política citada: revísala antes de enviar.");
    expect(sentences[1]).toHaveTextContent("Fuente [1] Devoluciones");
    expect(sentences[2]).toHaveTextContent("Fuentes [1] Devoluciones · [2] Plazo de reembolso");
    const sources = within(screen.getByRole("list", { name: "Políticas citadas" })).getAllByRole("listitem");
    expect(sources[0]).toHaveTextContent("[1] Devoluciones");
    expect(sources[0]).toHaveTextContent("Necesitamos el número de pedido y el motivo de la devolución.");
    expect(sources[1]).toHaveTextContent("[2] Plazo de reembolso");
    expect(screen.getByText(/no garantizan que la respuesta sea correcta/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Texto para enviar" })).toHaveValue(
      "Gracias por escribirnos. Para iniciar la devolución necesitamos el motivo. El reembolso se acredita en hasta 10 días hábiles.",
    );
  });

  it("copies the edited text, not the original draft", async () => {
    const writeText = clipboard();
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply: async () => draft })} />);
    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));
    const text = await screen.findByRole("textbox", { name: "Texto para enviar" });
    await userEvent.clear(text);
    await userEvent.type(text, "Hola, ¿nos indicás el motivo?");

    await userEvent.click(screen.getByRole("button", { name: "Copiar texto" }));

    expect(writeText).toHaveBeenCalledExactlyOnceWith("Hola, ¿nos indicás el motivo?");
    expect(screen.getByRole("status")).toHaveTextContent("Texto copiado. Pégalo en tu canal de respuesta.");
  });

  it("explains a copy failure instead of pretending it worked", async () => {
    clipboard(vi.fn(async () => { throw new Error("denied"); }));
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply: async () => draft })} />);
    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Copiar texto" }));

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    expect(screen.queryByText(/Texto copiado/)).not.toBeInTheDocument();
  });

  it("disables generation while waiting so one click makes one request", async () => {
    let resolve: (value: ReplyDraft) => void = () => {};
    const draftReply = vi.fn(() => new Promise<ReplyDraft>((done) => { resolve = done; }));
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply })} />);

    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));
    const waiting = screen.getByRole("button", { name: "Generando…" });
    expect(waiting).toBeDisabled();
    await userEvent.click(waiting);
    resolve(draft);

    expect(await screen.findByRole("button", { name: "Generar otro borrador" })).toBeEnabled();
    expect(draftReply).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: "drafter_unavailable", message: "El servicio de IA no está disponible. Inténtalo de nuevo más tarde." },
    { code: "drafter_invalid_output", message: "La IA devolvió un borrador inválido o con fuentes desconocidas. Puedes generarlo de nuevo." },
    { code: "not_draftable", message: "Clasifica la solicitud antes de generar un borrador." },
    { code: "http_error", message: "No se pudo generar el borrador. Inténtalo de nuevo." },
  ])("explains the $code error and lets the person retry", async ({ code, message }) => {
    const draftReply = vi.fn(async () => { throw new ApiError(502, code); });
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply })} />);

    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Generar borrador" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Texto para enviar" })).not.toBeInTheDocument();
  });

  it("keeps the previous draft visible when a new attempt fails", async () => {
    const draftReply = vi.fn().mockResolvedValueOnce(draft).mockRejectedValueOnce(new ApiError(503, "drafter_unavailable"));
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi({ draftReply })} />);
    await userEvent.click(screen.getByRole("button", { name: "Generar borrador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Generar otro borrador" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect((screen.getByRole("textbox", { name: "Texto para enviar" }) as HTMLTextAreaElement).value).toContain("Gracias por escribirnos.");
  });

  it("can be disabled while the review is being saved", () => {
    render(<ReplyDraftPanel ticketId="t-1" api={fakeApi()} disabled />);
    expect(screen.getByRole("button", { name: "Generar borrador" })).toBeDisabled();
  });
});
