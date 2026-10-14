import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TicketList } from "../src/components/TicketList.js";
import { allTickets, awaitingTicket, reviewedTicket } from "./fixtures.js";

describe("TicketList", () => {
  it("sorts chronologically in both directions without mutating input, with deterministic ties", async () => {
    const tickets = [
      { ...awaitingTicket, id: "z-tie", receivedAt: "2026-10-13T12:00:00+02:00" },
      { ...awaitingTicket, id: "latest", receivedAt: "2026-10-14T10:00:00Z" },
      { ...awaitingTicket, id: "a-tie", receivedAt: "2026-10-13T10:00:00Z" },
      { ...awaitingTicket, id: "oldest", receivedAt: "2026-10-12T10:00:00Z" },
    ];
    const originalIds = tickets.map((t) => t.id);
    render(<TicketList tickets={tickets} onSelect={() => {}} />);
    const ids = () => screen.getAllByRole("listitem").map((item) => item.querySelector(".ticket-id")?.textContent);
    expect(screen.getByLabelText("Ordenar solicitudes")).toHaveValue("oldest");
    expect(ids()).toEqual(["oldest", "a-tie", "z-tie", "latest"]);
    await userEvent.selectOptions(screen.getByLabelText("Ordenar solicitudes"), "newest");
    expect(ids()).toEqual(["latest", "a-tie", "z-tie", "oldest"]);
    expect(tickets.map((t) => t.id)).toEqual(originalIds);
  });

  it("combines known missing-data with other filters and resets it without resetting order", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Ordenar solicitudes"), "newest");
    await userEvent.click(screen.getByRole("checkbox", { name: "Solo con datos faltantes" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("1 de 4 solicitudes")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "returns");
    await userEvent.type(screen.getByRole("searchbox"), "4821");
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Revisada/ }));
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByLabelText("Ordenar solicitudes")).toHaveValue("newest");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("uses final reviewed missing fields and reacts to updated tickets", async () => {
    if (reviewedTicket.status !== "reviewed" || awaitingTicket.status !== "awaiting_review") throw new Error("fixtures");
    const reviewedMissing = { ...reviewedTicket, review: { ...reviewedTicket.review, final: { ...reviewedTicket.review.final, extracted: {}, missingFields: ["order_number" as const] } } };
    const resolved = { ...awaitingTicket, status: "reviewed" as const, review: { decision: "corrected" as const, reviewedAt: "2026-10-14T10:00:00Z", final: { category: "returns" as const, extracted: { orderNumber: "4821", returnReason: "Talle" }, missingFields: [] } } };
    const { rerender } = render(<TicketList tickets={[reviewedMissing, resolved]} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("t-reviewed");
    rerender(<TicketList tickets={[reviewedTicket, resolved]} onSelect={() => {}} />);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText("0 de 2 solicitudes")).toBeInTheDocument();
  });

  it.each([
    [" CORDOBA ", "t-new"],
    ["T-FAILED", "t-failed"],
    ["4821", "t-await"],
    ["cliente pregunta", "t-reviewed"],
  ])("searches text, ids, orders and summaries without case or accent sensitivity: %s", async (query, id) => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar solicitudes" }), query);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(id);
    expect(screen.getByText("1 de 4 solicitudes")).toBeInTheDocument();
  });

  it("combines category, status and search, then clears every filter", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "returns");
    await userEvent.type(screen.getByRole("searchbox"), "4821");
    const filters = within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" }));
    await userEvent.click(filters.getByRole("button", { name: /Revisada/ }));
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText("0 de 4 solicitudes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByLabelText("Filtrar por categoría")).toHaveValue("all");
    expect(filters.getByRole("button", { name: /Todas/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("includes new and failed tickets under unclassified", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "unclassified");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("El cliente quiere devolver el pedido 4821.")).not.toBeInTheDocument();
  });

  it("uses the final corrected category and extracted data rather than the old suggestion", async () => {
    if (reviewedTicket.status !== "reviewed") throw new Error("reviewed fixture");
    const corrected = {
      ...reviewedTicket, body: "Consulta",
      review: { ...reviewedTicket.review, final: {
        category: "returns" as const, extracted: { orderNumber: "9876", returnReason: "Tamaño equivocado" }, missingFields: [],
      } },
    };
    render(<TicketList tickets={[corrected]} onSelect={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "returns");
    const search = screen.getByRole("searchbox");
    await userEvent.type(search, "TAMANO");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await userEvent.clear(search);
    await userEvent.type(search, "9876");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "shipping");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows a count per status", () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    const filters = screen.getByRole("group", { name: "Filtrar solicitudes por estado" });
    const tabs = within(filters).getAllByRole("button").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Todas4", "Por revisar1", "Fallida1", "Nueva1", "Revisada1"]);
  });

  it("filters tickets by status", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    await userEvent.click(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Por revisar/ }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("El cliente quiere devolver el pedido 4821.");
    expect(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Por revisar/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("lets keyboard users activate native status filters", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);
    within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Todas/ }).focus();
    expect(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Todas/ })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Por revisar/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the summary for triaged tickets and the original text otherwise", () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    expect(screen.getByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.getByText("Hola, ¿tienen local en Córdoba?")).toBeInTheDocument();
  });

  it("flags missing data on a ticket", () => {
    render(<TicketList tickets={[awaitingTicket]} onSelect={() => {}} />);

    expect(within(screen.getByRole("listitem")).getByText("Falta: motivo de devolución")).toBeInTheDocument();
  });

  it("calls onSelect with the ticket id", async () => {
    const onSelect = vi.fn();
    render(<TicketList tickets={allTickets} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("El cliente quiere devolver el pedido 4821."));

    expect(onSelect).toHaveBeenCalledWith("t-await");
  });

  it("marks the selected ticket", () => {
    render(<TicketList tickets={allTickets} selectedId="t-await" onSelect={() => {}} />);

    const selected = screen.getByRole("button", { current: true });
    expect(selected).toHaveTextContent("El cliente quiere devolver el pedido 4821.");
  });

  it("explains when a filter has no tickets", async () => {
    render(<TicketList tickets={[awaitingTicket]} onSelect={() => {}} />);

    await userEvent.click(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Fallida/ }));

    expect(screen.getByText(/No hay solicitudes en esta vista\./)).toBeInTheDocument();
  });
});
