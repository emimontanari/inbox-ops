import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ReviewedTicket } from "../../src/domain/ticket.js";
import { ApiError } from "../src/api.js";
import { App } from "../src/App.js";
import { fakeApi } from "./fake-api.js";
import { allTickets, awaitingTicket } from "./fixtures.js";

describe("App", () => {
  it("loads and shows the tickets", async () => {
    render(<App api={fakeApi({ listTickets: async () => allTickets })} />);

    expect(screen.getByText("Loading tickets…")).toBeInTheDocument();
    expect(await screen.findByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.queryByText("Loading tickets…")).not.toBeInTheDocument();
  });

  it("explains when the API is not reachable", async () => {
    const listTickets = async () => {
      throw new ApiError(502, "http_error");
    };
    render(<App api={fakeApi({ listTickets })} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load tickets. Is the API running? (npm run serve)",
    );
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
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reviewed/ })).toHaveTextContent("Reviewed2");
    expect(screen.getByRole("tab", { name: /To review/ })).toHaveTextContent("To review0");
  });
});
