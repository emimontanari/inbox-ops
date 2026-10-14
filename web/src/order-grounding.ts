export type OrderGrounding = "not_provided" | "present" | "not_found";

// Textual presence only: a planted number or phone number can still match.
// Never use this result as proof of customer intent, order existence or ownership.
export function assessOrderGrounding(body: string, orderNumber?: string): OrderGrounding {
  const number = orderNumber?.trim().replace(/^#/, "").trim() ?? "";
  if (!number) return "not_provided";
  const tokens = body.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return tokens.some((token) => token.toLocaleLowerCase("es") === number.toLocaleLowerCase("es"))
    ? "present"
    : "not_found";
}
