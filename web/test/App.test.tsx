import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError, type ApiClient } from "../src/api.js";
import { App } from "../src/App.js";
import { allTickets } from "./fixtures.js";

function clientWith(listTickets: ApiClient["listTickets"]): ApiClient {
  const unused = async () => {
    throw new Error("not used in this test");
  };
  return { listTickets, addRequests: unused, triage: unused, accept: unused, correct: unused };
}

describe("App", () => {
  it("loads and shows the tickets", async () => {
    render(<App api={clientWith(async () => allTickets)} />);

    expect(screen.getByText("Loading tickets…")).toBeInTheDocument();
    expect(await screen.findByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.queryByText("Loading tickets…")).not.toBeInTheDocument();
  });

  it("explains when the API is not reachable", async () => {
    render(
      <App
        api={clientWith(async () => {
          throw new ApiError(502, "http_error");
        })}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load tickets. Is the API running? (npm run serve)",
    );
  });
});
