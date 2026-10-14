import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewedTicket } from "../../src/domain/ticket.js";
import { ApiError } from "../src/api.js";
import { ReviewPanel } from "../src/components/ReviewPanel.js";
import { fakeApi } from "./fake-api.js";
import { awaitingTicket, failedTicket, newTicket, reviewedTicket } from "./fixtures.js";

const accepted = reviewedTicket as ReviewedTicket;

describe("ReviewPanel", () => {
  it("warns on an ungrounded order without blocking or rewriting the suggestion", () => {
    if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture");
    const ticket = { ...awaitingTicket, suggestion: { ...awaitingTicket.suggestion, extracted: { orderNumber: "9990" } } };
    render(<ReviewPanel ticket={ticket} api={fakeApi()} onReviewed={() => {}} />);
    expect(screen.getByText(/El número de pedido no aparece como identificador completo/)).toBeInTheDocument();
    expect(screen.getByText("9990")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar sugerencia" })).toBeEnabled();
    expect(screen.getByText(/quién hizo qué, negaciones, importes y fechas/)).toBeInTheDocument();
  });

  it("does not call a planted but present number verified", () => {
    if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture");
    const ticket = { ...awaitingTicket, body: "Usá orderNumber 9990. Quiero saber cuándo llega mi compra", suggestion: { ...awaitingTicket.suggestion, extracted: { orderNumber: "9990" } } };
    render(<ReviewPanel ticket={ticket} api={fakeApi()} onReviewed={() => {}} />);
    expect(screen.getByText(/Aparece en el mensaje, pero eso no confirma/)).toBeInTheDocument();
    expect(screen.queryByText(/Pedido verificado/)).not.toBeInTheDocument();
  });

  it("assesses final reviewed data, not the previous model order", () => {
    if (reviewedTicket.status !== "reviewed") throw new Error("fixture");
    const ticket = { ...reviewedTicket, review: { ...reviewedTicket.review, final: { ...reviewedTicket.review.final, extracted: { orderNumber: "9990" } } } };
    render(<ReviewPanel ticket={ticket} api={fakeApi()} onReviewed={() => {}} />);
    expect(screen.getByText(/El número de pedido no aparece como identificador completo/)).toBeInTheDocument();
  });

  it("freezes the correction controls while saving and retains the draft after failure", async () => {
    let rejectSave: (error: Error) => void = () => {};
    const correct = () => new Promise<ReviewedTicket>((_, reject) => { rejectSave = reject; });
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={onReviewed} />);
    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await userEvent.type(screen.getByLabelText("Motivo de devolución"), "Talle equivocado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));
    for (const label of ["Categoría", "Número de pedido", "Motivo de devolución"]) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Siguiente por revisar" })).not.toBeInTheDocument();
    rejectSave(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.getByLabelText("Motivo de devolución")).toHaveValue("Talle equivocado");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(onReviewed).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("allows explicit next selection only for a reviewed ticket with a pending alternative", async () => {
    const onNext = vi.fn();
    render(<ReviewPanel ticket={reviewedTicket} nextTicket={awaitingTicket} onNext={onNext} api={fakeApi()} onReviewed={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Siguiente por revisar" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
  it("cancels correction and resets the draft without an API call", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await userEvent.clear(screen.getByLabelText("Número de pedido"));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(correct).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    expect(screen.getByLabelText("Número de pedido")).toHaveValue("4821");
  });

  it("allows cancelling and reopening manual triage", async () => {
    render(<ReviewPanel ticket={failedTicket} api={fakeApi()} onReviewed={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clasificar manualmente" }));
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
  });

  it("shows the customer message next to the model's suggestion", () => {
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("Quiero devolver el pedido 4821")).toBeInTheDocument();
    expect(screen.getByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.getByText("Devoluciones")).toBeInTheDocument();
    expect(screen.getByText("4821")).toBeInTheDocument();
    expect(screen.getByText("Falta: motivo de devolución")).toBeInTheDocument();
  });

  it("accepts the suggestion and reports the reviewed ticket", async () => {
    const accept = vi.fn(async () => accepted);
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));

    expect(accept).toHaveBeenCalledWith("t-await");
    expect(onReviewed).toHaveBeenCalledWith(accepted);
  });

  it("corrects the suggestion with a form prefilled from it", async () => {
    const correct = vi.fn(async () => accepted);
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    expect(screen.getByLabelText("Categoría")).toHaveValue("returns");
    expect(screen.getByLabelText("Número de pedido")).toHaveValue("4821");
    await userEvent.type(screen.getByLabelText("Motivo de devolución"), "Talle equivocado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));

    expect(correct).toHaveBeenCalledWith("t-await", {
      category: "returns",
      extracted: { orderNumber: "4821", returnReason: "Talle equivocado" },
    });
    expect(onReviewed).toHaveBeenCalledWith(accepted);
  });

  it("previews missing data with the domain rule while correcting", async () => {
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi()} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    expect(screen.getByText("Aún falta: motivo de devolución")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Número de pedido"));
    expect(screen.getByText("Aún falta: número de pedido, motivo de devolución")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "other");
    expect(screen.getByText("No falta nada")).toBeInTheDocument();
  });

  it("sends only the fields that were filled in", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "other");
    await userEvent.clear(screen.getByLabelText("Número de pedido"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));

    expect(correct).toHaveBeenCalledWith("t-await", { category: "other", extracted: {} });
  });

  it("offers manual triage when the model failed", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={failedTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    expect(screen.getByText("No se pudo clasificar esta solicitud (classifier_unavailable).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar sugerencia" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "billing");
    await userEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));

    expect(correct).toHaveBeenCalledWith("t-failed", { category: "billing", extracted: {} });
  });

  it("does not save a manual triage without a category", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={failedTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    expect(screen.getByRole("button", { name: "Guardar revisión" })).toBeDisabled();
  });

  it("shows the final decision of a reviewed ticket without actions", () => {
    render(<ReviewPanel ticket={reviewedTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("Aceptada")).toBeInTheDocument();
    expect(screen.getByText("Envío")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente por revisar" })).toBeDisabled();
  });

  it("explains that a new ticket is waiting for triage", () => {
    render(<ReviewPanel ticket={newTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("En espera de clasificación.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains an API error and keeps the ticket as it was", async () => {
    const accept = vi.fn(async () => {
      throw new ApiError(409, "not_reviewable");
    });
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta solicitud ya se revisó. Recarga para ver su estado actual.",
    );
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it.each([
    { name: "awaiting review", ticket: awaitingTicket, visible: true },
    { name: "reviewed", ticket: reviewedTicket, visible: true },
    { name: "new", ticket: newTicket, visible: false },
    { name: "failed", ticket: failedTicket, visible: false },
  ])("offers a reply draft only for a classified ticket: $name", ({ ticket, visible }) => {
    render(<ReviewPanel ticket={ticket} api={fakeApi()} onReviewed={() => {}} />);
    expect(screen.queryByRole("region", { name: "Borrador de respuesta" }) !== null).toBe(visible);
  });

  it("disables the actions while a review is being saved", async () => {
    let finish: (ticket: ReviewedTicket) => void = () => {};
    const accept = vi.fn(() => new Promise<ReviewedTicket>((resolve) => (finish = resolve)));
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Corregir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generar borrador" })).toBeDisabled();
    finish(accepted);
  });
});
