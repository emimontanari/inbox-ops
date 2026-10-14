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

    expect(valueOf("Tasa de aceptación")).toHaveTextContent("100%");
    expect(valueOf("Sugerencias aceptadas")).toHaveTextContent("1");
    expect(valueOf("Sugerencias corregidas")).toHaveTextContent("0");
    expect(valueOf("Clasificadas manualmente")).toHaveTextContent("0");
  });

  it("shows a dash before any suggestion is reviewed", () => {
    render(<ReviewStats tickets={[]} />);

    expect(valueOf("Tasa de aceptación")).toHaveTextContent("—");
  });
});
