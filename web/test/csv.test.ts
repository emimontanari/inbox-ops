import { describe, expect, it } from "vitest";
import { parseRequestsCsv } from "../src/csv.js";

describe("parseRequestsCsv", () => {
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
      error: 'The CSV needs a header row with a "body" column.',
    });
  });

  it("reports an unclosed quote", () => {
    expect(parseRequestsCsv('body\n"Hola')).toEqual({ ok: false, error: "The CSV has an unclosed quote." });
  });

  it("reports a file with no requests", () => {
    expect(parseRequestsCsv("body\n")).toEqual({ ok: false, error: "The CSV has no requests." });
  });
});
