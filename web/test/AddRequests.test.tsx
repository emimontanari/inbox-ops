import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddRequests } from "../src/components/AddRequests.js";
import { fakeApi } from "./fake-api.js";

describe("AddRequests", () => {
  it("adds a single message and reports it", async () => {
    const addRequests = vi.fn(async () => ({ added: ["gen-1"], rejected: [] }));
    const onAdded = vi.fn();
    render(<AddRequests api={fakeApi({ addRequests })} onAdded={onAdded} />);

    await userEvent.type(screen.getByLabelText("Customer message"), "¿Dónde está mi pedido?");
    await userEvent.click(screen.getByRole("button", { name: "Add request" }));

    expect(addRequests).toHaveBeenCalledWith([{ body: "¿Dónde está mi pedido?" }]);
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Added 1 request.");
    expect(screen.getByLabelText("Customer message")).toHaveValue("");
  });

  it("does not add an empty message", () => {
    render(<AddRequests api={fakeApi()} onAdded={() => {}} />);

    expect(screen.getByRole("button", { name: "Add request" })).toBeDisabled();
  });

  it("imports a CSV file and lists rejected rows", async () => {
    const addRequests = vi.fn(async () => ({
      added: ["t-1"],
      rejected: [{ index: 1, id: "t-2", error: "empty_body" as const }],
    }));
    render(<AddRequests api={fakeApi({ addRequests })} onAdded={() => {}} />);

    const file = new File(['id,body\nt-1,Hola\nt-2," "'], "requests.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("Import CSV"), file);

    expect(addRequests).toHaveBeenCalledWith([
      { id: "t-1", body: "Hola" },
      { id: "t-2", body: " " },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("Added 1 request. Rejected 1: #2 (t-2) empty message.");
  });

  it("sends large files in batches the API accepts", async () => {
    const addRequests = vi.fn(async (requests: Array<{ body: string }>) => ({
      added: requests.map((_, i) => `id-${i}`),
      rejected: [],
    }));
    render(<AddRequests api={fakeApi({ addRequests })} onAdded={() => {}} />);

    const rows = Array.from({ length: 250 }, (_, i) => `Pedido ${i}`).join("\n");
    await userEvent.upload(screen.getByLabelText("Import CSV"), new File([`body\n${rows}`], "big.csv"));

    expect(await screen.findByRole("status")).toHaveTextContent("Added 250 requests.");
    expect(addRequests.mock.calls.map(([batch]) => batch.length)).toEqual([200, 50]);
  });

  it("explains an invalid CSV without calling the API", async () => {
    const addRequests = vi.fn();
    render(<AddRequests api={fakeApi({ addRequests })} onAdded={() => {}} />);

    await userEvent.upload(screen.getByLabelText("Import CSV"), new File(["message\nHola"], "bad.csv"));

    expect(await screen.findByRole("alert")).toHaveTextContent('The CSV needs a header row with a "body" column.');
    expect(addRequests).not.toHaveBeenCalled();
  });
});
