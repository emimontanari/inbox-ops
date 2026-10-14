import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { retrievePassages } from "../../src/application/retrieve-passages.js";
import { parsePolicyPassages, type PolicyPassage } from "../../src/domain/policy.js";

const passages: PolicyPassage[] = [
  { id: "returns-window", title: "Devoluciones", topics: ["returns"], text: "Aceptamos devoluciones dentro de los 30 días. Para iniciar una devolución necesitamos el número de pedido y el motivo." },
  { id: "shipping-tracking", title: "Seguimiento de envíos", topics: ["shipping"], text: "Si el seguimiento no muestra novedades durante 48 horas hábiles, abrimos una consulta con el transportista." },
  { id: "billing-double-charge", title: "Cargos duplicados", topics: ["billing"], text: "Un cargo pendiente es una autorización temporal y se libera en hasta 7 días hábiles." },
  { id: "store-hours", title: "Atención", topics: ["other"], text: "Respondemos consultas de lunes a viernes." },
];

describe("retrievePassages", () => {
  it("ranks passages by shared words, ignoring case and accents", () => {
    const result = retrievePassages(passages, { text: "QUIERO DEVOLVER el pedido, ¿cuál es el MOTIVO que necesitan?" });
    expect(result.map((item) => item.id)[0]).toBe("returns-window");
  });

  it("matches word stems such as devolver and devolución", () => {
    expect(retrievePassages(passages, { text: "devolver" }).map((item) => item.id)).toEqual(["returns-window"]);
  });

  it("boosts passages of the ticket category", () => {
    const result = retrievePassages(passages, { text: "pedido", category: "shipping" });
    expect(result[0]?.id).toBe("shipping-tracking");
  });

  it("returns at most the requested number of passages", () => {
    expect(retrievePassages(passages, { text: "pedido novedades cargo consultas", category: "billing" }, 2)).toHaveLength(2);
  });

  it("returns nothing when no word or category matches", () => {
    expect(retrievePassages(passages, { text: "hola" })).toEqual([]);
  });

  it("is deterministic for ties, ordering by id", () => {
    const tie: PolicyPassage[] = [
      { id: "b", title: "B", topics: ["other"], text: "garantía" },
      { id: "a", title: "A", topics: ["other"], text: "garantía" },
    ];
    expect(retrievePassages(tie, { text: "garantía" }).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("finds the returns policy for a return request in the shipped knowledge base", () => {
    const shipped = parsePolicyPassages(JSON.parse(readFileSync(new URL("../../knowledge/store-policies.json", import.meta.url), "utf8")));
    const ids = retrievePassages(shipped, { text: "Quiero devolver el pedido 64132.", category: "returns" }).map((item) => item.id);
    expect(ids).toContain("returns-window");
  });

  it("does not mutate the input list", () => {
    const copy = structuredClone(passages);
    retrievePassages(passages, { text: "devolver pedido", category: "returns" });
    expect(passages).toEqual(copy);
  });
});
