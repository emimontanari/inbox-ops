import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelatedTickets } from "../src/components/RelatedTickets.js";
import { awaitingTicket, newTicket, reviewedTicket } from "./fixtures.js";

describe("RelatedTickets", () => {
  it("shows shared order, state, category and explicit limitations, and opens a related ticket", async () => {
    if (reviewedTicket.status !== "reviewed") throw new Error("fixture");
    const related = { ...reviewedTicket, review: { ...reviewedTicket.review, final: { ...reviewedTicket.review.final, extracted: { orderNumber: "4821" } } } };
    const onOpen = vi.fn();
    render(<RelatedTickets selected={awaitingTicket} tickets={[awaitingTicket, related]} onOpen={onOpen} disabled={false} />);
    const panel = screen.getByRole("region", { name: "Solicitudes relacionadas" });
    expect(within(panel).getByText(/Pedido 4821/)).toBeInTheDocument();
    expect(within(panel).getByText(/no confirma identidad ni titularidad/)).toBeInTheDocument();
    expect(within(panel).getByText(/Revisada · Envío/)).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Abrir solicitud t-reviewed" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("t-reviewed");
  });
  it("explains missing order and empty matches without implying no other customer messages exist", () => {
    const { rerender } = render(<RelatedTickets selected={newTicket} tickets={[newTicket]} onOpen={() => {}} disabled={false} />);
    expect(screen.getByText(/No hay número de pedido en la clasificación actual/)).toBeInTheDocument();
    rerender(<RelatedTickets selected={awaitingTicket} tickets={[awaitingTicket]} onOpen={() => {}} disabled={false} />);
    expect(screen.getByText(/No hay otras solicitudes con este número en la bandeja cargada/)).toBeInTheDocument();
  });
  it("disables related navigation during a save", () => {
    const other = { ...awaitingTicket, id: "other" };
    render(<RelatedTickets selected={awaitingTicket} tickets={[other]} onOpen={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Abrir solicitud other" })).toBeDisabled();
  });
});
