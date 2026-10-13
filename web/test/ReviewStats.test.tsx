import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewStats } from "../src/components/ReviewStats.js";
import { allTickets } from "./fixtures.js";

function valueOf(label: string) {
  return screen.getByText(label).nextElementSibling;
}

describe("ReviewStats", () => {
  it("shows the acceptance rate and the review decisions", () => {
    render(<ReviewStats tickets={allTickets} />);

    expect(valueOf("Acceptance rate")).toHaveTextContent("100%");
    expect(valueOf("Suggestions accepted")).toHaveTextContent("1");
    expect(valueOf("Suggestions corrected")).toHaveTextContent("0");
    expect(valueOf("Triaged manually")).toHaveTextContent("0");
  });

  it("shows a dash before any suggestion is reviewed", () => {
    render(<ReviewStats tickets={[]} />);

    expect(valueOf("Acceptance rate")).toHaveTextContent("—");
  });
});
