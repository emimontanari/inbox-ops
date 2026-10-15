import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewedTicket } from "../../src/domain/ticket.js";
import { ReviewHistory } from "../src/components/ReviewHistory.js";
import { reviewedTicket } from "./fixtures.js";
const accepted = reviewedTicket as ReviewedTicket;
describe("ReviewHistory", () => {
  it("shows the stored date, original summary and no changes for acceptance", () => {
    render(<ReviewHistory ticket={accepted} />);
    const region = screen.getByRole("region", { name: "Historial de revisión" });
    expect(within(region).getByText("Aceptación de sugerencia")).toBeInTheDocument();
    expect(within(region).getByText("Sin cambios en los campos comparados.")).toBeInTheDocument();
    expect(region.querySelector("time")).toHaveAttribute("dateTime", accepted.review.reviewedAt);
    expect(within(region).getByText(/Resumen original del modelo/)).toBeInTheDocument();
    expect(within(region).getAllByText("Sin cambios")).toHaveLength(4);
    expect(within(region).getByText(/No registra versiones anteriores ni identifica al operador/)).toBeInTheDocument();
  });
  it("shows added, removed and changed fields as original vs final, including missing-data changes", () => {
    const corrected: ReviewedTicket = { ...accepted, review: { ...accepted.review, decision: "corrected", final: { category: "returns", extracted: { returnReason: "Talle incorrecto" }, missingFields: ["order_number"] } } };
    render(<ReviewHistory ticket={corrected} />);
    const region = screen.getByRole("region", { name: "Historial de revisión" });
    expect(within(region).getByText("Corrección humana")).toBeInTheDocument();
    expect(within(region).getAllByText("Modificado")).toHaveLength(4);
    const order = within(region).getByRole("group", { name: "Número de pedido" });
    expect(order).toHaveTextContent("Sugerencia original1234");
    expect(order).toHaveTextContent("Clasificación finalNo informado");
    const reason = within(region).getByRole("group", { name: "Motivo de devolución" });
    expect(reason).toHaveTextContent("Talle incorrecto");
  });
  it("does not fabricate an original suggestion, error or modifications for manual review", () => {
    const manual: ReviewedTicket = { id: "m", body: "Hola", receivedAt: accepted.receivedAt, status: "reviewed", review: { ...accepted.review, decision: "manual" } };
    render(<ReviewHistory ticket={manual} />);
    expect(screen.getByText("Clasificación manual")).toBeInTheDocument();
    expect(screen.getByText(/No hay sugerencia original guardada para comparar/)).toBeInTheDocument();
    expect(screen.queryByText("Modificado")).not.toBeInTheDocument();
    expect(screen.queryByText(/Resumen original del modelo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Error de clasificación guardado/)).not.toBeInTheDocument();
  });
  it("retains correction action even when no compared values changed", () => {
    render(<ReviewHistory ticket={{ ...accepted, review: { ...accepted.review, decision: "corrected" } }} />);
    expect(screen.getByText("Corrección humana")).toBeInTheDocument();
    expect(screen.getByText("Sin cambios en los campos comparados.")).toBeInTheDocument();
  });
  it("shows the stored classifier failure for a manual decision", () => {
    const manual: ReviewedTicket = { id: "m", body: "Hola", receivedAt: accepted.receivedAt, status: "reviewed", triageError: "classifier_unavailable", review: { ...accepted.review, decision: "manual" } };
    render(<ReviewHistory ticket={manual} />);
    expect(screen.getByText(/Error de clasificación guardado: classifier_unavailable/)).toBeInTheDocument();
  });
});
