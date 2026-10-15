import { describe, expect, it } from "vitest";
import { parseRequestsCsv } from "../src/csv.js";

describe("parseRequestsCsv", () => {
  it("passes optional receivedAt through and omits blank dates (server validates per row)", () => {
    expect(parseRequestsCsv("body,receivedAt,id\nHola,2026-10-13T08:00:00Z,t-1\nOtra, ,t-2\nMala,tomorrow,t-3")).toEqual({ ok: true, value: [
      { body: "Hola", id: "t-1", receivedAt: "2026-10-13T08:00:00Z" },
      { body: "Otra", id: "t-2" },
      { body: "Mala", id: "t-3", receivedAt: "tomorrow" },
    ] });
  });
  it("reads id and body columns in any order and case", () => {
    expect(parseRequestsCsv("Body,ID\nWhere is my order?,t-1\nMe cobraron dos veces,t-2\n")).toEqual({
      ok: true,
      value: [
        { id: "t-1", body: "Where is my order?" },
        { id: "t-2", body: "Me cobraron dos veces" },
      ],
    });
  });

  it("works without an id column", () => {
    expect(parseRequestsCsv("body\nHola")).toEqual({ ok: true, value: [{ body: "Hola" }] });
  });

  it("omits an empty id so the server generates one", () => {
    expect(parseRequestsCsv("id,body\n,Hola")).toEqual({ ok: true, value: [{ body: "Hola" }] });
  });

  it("handles quoted fields with commas, escaped quotes and line breaks", () => {
    const csv = 'id,body\nt-1,"Pedido 4821, talla ""M"" equivocada\nquiero devolverlo"\n';

    expect(parseRequestsCsv(csv)).toEqual({
      ok: true,
      value: [{ id: "t-1", body: 'Pedido 4821, talla "M" equivocada\nquiero devolverlo' }],
    });
  });

  it("accepts Windows line endings, a byte order mark and blank lines", () => {
    expect(parseRequestsCsv("\uFEFFbody\r\nPrimero\r\n\r\nSegundo\r\n")).toEqual({
      ok: true,
      value: [{ body: "Primero" }, { body: "Segundo" }],
    });
  });

  it("requires a body column", () => {
    expect(parseRequestsCsv("id,message\nt-1,Hola")).toEqual({
      ok: false,
      error: 'El CSV necesita una fila de encabezado con una columna "body".',
    });
  });

  it("reports an unclosed quote", () => {
    expect(parseRequestsCsv('body\n"Hola')).toEqual({ ok: false, error: "El CSV tiene una comilla sin cerrar." });
  });

  it("reports a file with no requests", () => {
    expect(parseRequestsCsv("body\n")).toEqual({ ok: false, error: "El CSV no contiene solicitudes." });
  });
});
