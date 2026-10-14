import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewedTicket, Ticket } from "../../src/domain/ticket.js";
import { ApiError } from "../src/api.js";
import { App } from "../src/App.js";
import { fakeApi } from "./fake-api.js";
import { allTickets, awaitingTicket, failedTicket, newTicket } from "./fixtures.js";

describe("App", () => {
  it("makes review the primary workspace and keeps intake after it", async () => {
    const triage = vi.fn();
    render(<App api={fakeApi({ listTickets: async () => allTickets, triage })} />);

    const workspace = await screen.findByRole("main", { name: "Bandeja de soporte" });
    const intake = screen.getByText("Agregar solicitudes");
    expect(workspace.compareDocumentPosition(intake) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(workspace).getByRole("region", { name: "Revisión de solicitud" })).toBeInTheDocument();
    expect(triage).not.toHaveBeenCalled();
  });

  it("filters locally without API calls and preserves an active correction draft", async () => {
    const listTickets = vi.fn(async () => allTickets);
    const triage = vi.fn();
    render(<App api={fakeApi({ listTickets, triage })} />);
    await userEvent.click(await screen.findByText("El cliente quiere devolver el pedido 4821."));
    await userEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await userEvent.type(screen.getByLabelText("Motivo de devolución"), "Talle equivocado");
    await userEvent.type(screen.getByRole("searchbox"), "sin coincidencias");
    expect(within(screen.getByRole("region", { name: "Solicitudes" })).queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Motivo de devolución")).toHaveValue("Talle equivocado");
    expect(listTickets).toHaveBeenCalledTimes(1);
    expect(triage).not.toHaveBeenCalled();
  });

  it("loads and shows the tickets", async () => {
    render(<App api={fakeApi({ listTickets: async () => allTickets })} />);

    expect(screen.getByText("Cargando solicitudes…")).toBeInTheDocument();
    expect(await screen.findByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.queryByText("Cargando solicitudes…")).not.toBeInTheDocument();
  });

  it("explains when the API is not reachable", async () => {
    const listTickets = async () => {
      throw new ApiError(502, "http_error");
    };
    render(<App api={fakeApi({ listTickets })} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las solicitudes. ¿Está en marcha la API? (npm run serve)",
    );
  });

  it("runs triage and reloads the tickets", async () => {
    const listTickets = vi
      .fn<() => Promise<Ticket[]>>()
      .mockResolvedValueOnce([newTicket])
      .mockResolvedValueOnce([{ ...awaitingTicket, id: newTicket.id }]);
    const triage = vi.fn(async () => ({ triaged: 1, failed: 0 }));
    render(<App api={fakeApi({ listTickets, triage })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Clasificar" }));

    expect(triage).toHaveBeenCalledWith({});
    expect(await screen.findByRole("status")).toHaveTextContent("Clasificadas: 1; fallidas: 0.");
    expect(await screen.findByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(listTickets).toHaveBeenCalledTimes(2);
  });

  it("retries failed tickets", async () => {
    const triage = vi.fn(async () => ({ triaged: 1, failed: 0 }));
    render(<App api={fakeApi({ listTickets: async () => [failedTicket], triage })} />);

    expect(await screen.findByRole("button", { name: "Clasificar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar fallidas" }));

    expect(triage).toHaveBeenCalledWith({ retryFailed: true });
  });

  it("offers next global awaiting review after success and keeps confirmation", async () => {
    if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture must await review");
    const reviewed: ReviewedTicket = { ...awaitingTicket, status: "reviewed", review: { decision: "accepted", reviewedAt: "2026-10-13T10:10:00.000Z", final: { category: awaitingTicket.suggestion.category, extracted: awaitingTicket.suggestion.extracted, missingFields: awaitingTicket.suggestion.missingFields } } };
    const next = { ...awaitingTicket, id: "next", body: "Otra consulta", suggestion: { ...awaitingTicket.suggestion, requestId: "next", summary: "Segunda pendiente", category: "shipping" as const } };
    render(<App api={fakeApi({ listTickets: async () => [...allTickets, next], accept: async () => reviewed })} />);
    await userEvent.click(await screen.findByText("El cliente quiere devolver el pedido 4821."));
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por categoría"), "returns");
    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Solicitud t-await: decisión aceptada.");
    expect(screen.getByText("Aceptada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente por revisar" }));
    expect(within(screen.getByRole("region", { name: "Revisión de solicitud" })).getByText("Otra consulta")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitud t-await: decisión aceptada.");
  });

  it("does not switch the selected ticket while a save is in flight", async () => {
    let finish: (ticket: ReviewedTicket) => void = () => {};
    const accept = () => new Promise<ReviewedTicket>((resolve) => { finish = resolve; });
    render(<App api={fakeApi({ listTickets: async () => allTickets, accept })} />);
    await userEvent.click(await screen.findByText("El cliente quiere devolver el pedido 4821."));
    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));
    await userEvent.click(screen.getByText("Me cobraron dos veces"));
    expect(within(screen.getByRole("region", { name: "Revisión de solicitud" })).getByText("Quiero devolver el pedido 4821")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente por revisar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture");
    finish({ ...awaitingTicket, status: "reviewed", review: { decision: "accepted", reviewedAt: "2026-10-14", final: awaitingTicket.suggestion } });
    expect(await screen.findByRole("status")).toHaveTextContent("aceptada");
  });

  it("reviews the selected ticket and updates the list", async () => {
    if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture must await review");
    const reviewed: ReviewedTicket = {
      ...awaitingTicket,
      status: "reviewed",
      review: {
        decision: "accepted",
        reviewedAt: "2026-10-13T10:10:00.000Z",
        final: {
          category: awaitingTicket.suggestion.category,
          extracted: awaitingTicket.suggestion.extracted,
          missingFields: awaitingTicket.suggestion.missingFields,
        },
      },
    };
    render(<App api={fakeApi({ listTickets: async () => allTickets, accept: async () => reviewed })} />);

    await userEvent.click(await screen.findByText("El cliente quiere devolver el pedido 4821."));
    await userEvent.click(screen.getByRole("button", { name: "Aceptar sugerencia" }));

    expect(await screen.findByText("Aceptada")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Revisada/ })).toHaveTextContent("Revisada2");
    expect(within(screen.getByRole("group", { name: "Filtrar solicitudes por estado" })).getByRole("button", { name: /Por revisar/ })).toHaveTextContent("Por revisar0");
  });
});
