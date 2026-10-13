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
  it("shows the customer message next to the model's suggestion", () => {
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("Quiero devolver el pedido 4821")).toBeInTheDocument();
    expect(screen.getByText("El cliente quiere devolver el pedido 4821.")).toBeInTheDocument();
    expect(screen.getByText("Returns")).toBeInTheDocument();
    expect(screen.getByText("4821")).toBeInTheDocument();
    expect(screen.getByText("Missing: return reason")).toBeInTheDocument();
  });

  it("accepts the suggestion and reports the reviewed ticket", async () => {
    const accept = vi.fn(async () => accepted);
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(accept).toHaveBeenCalledWith("t-await");
    expect(onReviewed).toHaveBeenCalledWith(accepted);
  });

  it("corrects the suggestion with a form prefilled from it", async () => {
    const correct = vi.fn(async () => accepted);
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByLabelText("Category")).toHaveValue("returns");
    expect(screen.getByLabelText("Order number")).toHaveValue("4821");
    await userEvent.type(screen.getByLabelText("Return reason"), "Talle equivocado");
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    expect(correct).toHaveBeenCalledWith("t-await", {
      category: "returns",
      extracted: { orderNumber: "4821", returnReason: "Talle equivocado" },
    });
    expect(onReviewed).toHaveBeenCalledWith(accepted);
  });

  it("previews missing data with the domain rule while correcting", async () => {
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi()} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByText("Still missing: return reason")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Order number"));
    expect(screen.getByText("Still missing: order number, return reason")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Category"), "other");
    expect(screen.getByText("Nothing missing")).toBeInTheDocument();
  });

  it("sends only the fields that were filled in", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Correct" }));
    await userEvent.selectOptions(screen.getByLabelText("Category"), "other");
    await userEvent.clear(screen.getByLabelText("Order number"));
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    expect(correct).toHaveBeenCalledWith("t-await", { category: "other", extracted: {} });
  });

  it("offers manual triage when the model failed", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={failedTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    expect(screen.getByText("The model could not triage this request (classifier_unavailable).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Category"), "billing");
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    expect(correct).toHaveBeenCalledWith("t-failed", { category: "billing", extracted: {} });
  });

  it("does not save a manual triage without a category", async () => {
    const correct = vi.fn(async () => accepted);
    render(<ReviewPanel ticket={failedTicket} api={fakeApi({ correct })} onReviewed={() => {}} />);

    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
  });

  it("shows the final decision of a reviewed ticket without actions", () => {
    render(<ReviewPanel ticket={reviewedTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Shipping")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains that a new ticket is waiting for triage", () => {
    render(<ReviewPanel ticket={newTicket} api={fakeApi()} onReviewed={() => {}} />);

    expect(screen.getByText("Waiting for triage.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains an API error and keeps the ticket as it was", async () => {
    const accept = vi.fn(async () => {
      throw new ApiError(409, "not_reviewable");
    });
    const onReviewed = vi.fn();
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={onReviewed} />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This ticket was already reviewed. Reload to see its current state.",
    );
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it("disables the actions while a review is being saved", async () => {
    let finish: (ticket: ReviewedTicket) => void = () => {};
    const accept = vi.fn(() => new Promise<ReviewedTicket>((resolve) => (finish = resolve)));
    render(<ReviewPanel ticket={awaitingTicket} api={fakeApi({ accept })} onReviewed={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Correct" })).toBeDisabled();
    finish(accepted);
  });
});
