import { describe, expect, it } from "vitest";
import type { PolicyPassage } from "../../src/domain/policy.js";
import { MAX_DRAFT_LENGTH, createReplyDraft } from "../../src/domain/reply-draft.js";

const returns: PolicyPassage = { id: "returns-window", title: "Devoluciones", topics: ["returns"], text: "Aceptamos devoluciones dentro de los 30 días." };
const privacy: PolicyPassage = { id: "privacy", title: "Privacidad", topics: ["other"], text: "Verificamos el número de pedido." };
const passages = [returns, privacy];

describe("createReplyDraft", () => {
  it("keeps sentences with their sources and lists only the cited passages", () => {
    const result = createReplyDraft(
      { sentences: [{ text: "Hola.", sourceIds: [] }, { text: "Aceptamos devoluciones dentro de los 30 días.", sourceIds: ["returns-window"] }] },
      passages,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        sentences: [{ text: "Hola.", sourceIds: [] }, { text: "Aceptamos devoluciones dentro de los 30 días.", sourceIds: ["returns-window"] }],
        sources: [returns],
      },
    });
  });

  it("trims text, drops blank sentences and removes repeated source ids", () => {
    const result = createReplyDraft(
      { sentences: [{ text: "  ", sourceIds: [] }, { text: " Texto. ", sourceIds: ["privacy", "privacy"] }] },
      passages,
    );

    expect(result).toEqual({ ok: true, value: { sentences: [{ text: "Texto.", sourceIds: ["privacy"] }], sources: [privacy] } });
  });

  it("orders sources as they were retrieved, not as they were cited", () => {
    const result = createReplyDraft({ sentences: [{ text: "A.", sourceIds: ["privacy", "returns-window"] }] }, passages);
    expect(result.ok && result.value.sources.map((source) => source.id)).toEqual(["returns-window", "privacy"]);
  });

  it("rejects a draft without text", () => {
    expect(createReplyDraft({ sentences: [{ text: " ", sourceIds: [] }] }, passages)).toEqual({ ok: false, error: "empty_draft" });
    expect(createReplyDraft({ sentences: [] }, passages)).toEqual({ ok: false, error: "empty_draft" });
  });

  it("rejects a draft longer than the limit", () => {
    const text = "a".repeat(MAX_DRAFT_LENGTH + 1);
    expect(createReplyDraft({ sentences: [{ text, sourceIds: [] }] }, passages)).toEqual({ ok: false, error: "draft_too_long" });
  });

  it("rejects a citation to a passage that was not provided", () => {
    const result = createReplyDraft({ sentences: [{ text: "Reembolso inmediato.", sourceIds: ["refund-now"] }] }, passages);
    expect(result).toEqual({ ok: false, error: "unknown_source" });
  });
});
