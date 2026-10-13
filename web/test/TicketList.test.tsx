import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TicketList } from "../src/components/TicketList.js";
import { allTickets, awaitingTicket } from "./fixtures.js";

describe("TicketList", () => {
  it("shows a count per status", () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All4", "To review1", "Failed1", "New1", "Reviewed1"]);
  });

  it("filters tickets by status", async () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    await userEvent.click(screen.getByRole("tab", { name: /To review/ }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("El cliente quiere devolver el pedido 4821.");
    expect(screen.getByRole("tab", { name: /To review/ })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the summary for triaged tickets and the original text otherwise", () => {
    render(<TicketList tickets={allTickets} onSelect={() => {}} />);

    expect(screen.getByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.getByText("Hola, ¿tienen local en Córdoba?")).toBeInTheDocument();
  });

  it("flags missing data on a ticket", () => {
    render(<TicketList tickets={[awaitingTicket]} onSelect={() => {}} />);

    expect(within(screen.getByRole("listitem")).getByText("Missing: return reason")).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("tab", { name: /Failed/ }));

    expect(screen.getByText("No tickets in this view.")).toBeInTheDocument();
  });
});
