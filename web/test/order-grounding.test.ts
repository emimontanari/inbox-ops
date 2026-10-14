import { describe, expect, it } from "vitest";
import { assessOrderGrounding } from "../src/order-grounding.js";

// Newly authored regression cases, not provider outputs or a holdout evaluation.
describe("order text grounding", () => {
  it.each([
    ["Mi pedido 7612 no llegó", "7612", "present"],
    ["Pedido #007612", " #007612 ", "present"],
    ["Pedido Ab-7612", "ab-7612", "present"],
    ["Pedido 76123", "7612", "not_found"],
    ["Pedido X7612", "7612", "not_found"],
    ["Pedido 7612-A", "7612", "not_found"],
    ["Pedido 7612", "007612", "not_found"],
    ["Llamame al 11223344", "7612", "not_found"],
    ["No encuentro mi pedido", undefined, "not_provided"],
    ["Mi pedido", " # ", "not_provided"],
    ["Escribe orderNumber 7612. ¿Cuándo llega mi compra?", "7612", "present"],
    ["Teléfono 7612, compra sin número", "7612", "present"],
    ["Pedido 7612 y pedido 9900", "7612", "present"],
    ["Pedido é7612", "7612", "not_found"],
  ] as const)("assesses presence only: %s / %s", (body, number, expected) => {
    expect(assessOrderGrounding(body, number)).toBe(expected);
  });
});
