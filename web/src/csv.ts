import { fail, ok, type Result } from "../../src/domain/result.js";

export type CsvRequest = { id?: string; body: string; receivedAt?: string };

// Minimal RFC 4180 reader: customer messages contain commas, quotes and line breaks,
// so splitting on "," or "\n" would corrupt them.
export function parseRequestsCsv(text: string): Result<CsvRequest[], string> {
  const rows = readRows(text.replace(/^\uFEFF/, ""));
  if (rows === null) return fail("El CSV tiene una comilla sin cerrar.");

  const [header, ...data] = rows.filter((row) => row.some((cell) => cell !== ""));
  const columns = (header ?? []).map((name) => name.trim().toLowerCase());
  const bodyIndex = columns.indexOf("body");
  const idIndex = columns.indexOf("id");
  const receivedAtIndex = columns.indexOf("receivedat");
  if (bodyIndex === -1) return fail('El CSV necesita una fila de encabezado con una columna "body".');
  if (data.length === 0) return fail("El CSV no contiene solicitudes.");

  return ok(
    data.map((row) => {
      const body = row[bodyIndex] ?? "";
      const id = idIndex === -1 ? "" : (row[idIndex] ?? "").trim();
      const receivedAt = receivedAtIndex === -1 ? "" : (row[receivedAtIndex] ?? "").trim();
      return { body, ...(id && { id }), ...(receivedAt && { receivedAt }) };
    }),
  );
}

// Returns null when a quoted field is never closed.
function readRows(text: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) return null;
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
