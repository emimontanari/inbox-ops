import { describe, expect, it } from "vitest";
import { buildSemanticPacket, summarizeSemanticReviews } from "../src/evaluation/draft-semantic-review.js";
const context = { customerMessage: "¿Descuentos?", category: "other", extracted: {}, missingFields: [], passages: [{ id: "p", title: "Política", topics: ["other"], text: "No documenta descuentos." }] };
const capture = { version: 1, provenance: "synthetic", cases: [{ id: "original-case", context, attempts: [{ status: "returned", output: { sentences: [{ text: "No hay descuentos.", sourceIds: [] }] } }, { status: "error", error: "unavailable" }] }] };
function review(packetHash: string, id: string, support = "unsupported") {
  return { packetHash, reviewer: { id, kind: "ai", exposure: "blind" }, responses: [{ responseId: "response-1-1", abstention: { label: "inappropriate", rationale: "Afirmó una política ausente." }, sentences: [{ index: 0, support, citations: "none", rationale: "Ausencia de evidencia no demuestra ausencia de descuentos.", evidenceIds: [] }] }] };
}
describe("semantic review packets and reports", () => {
  it("binds rubric v2 separately, preserves v1 default and rejects cross-version votes", () => {
    const v1 = buildSemanticPacket(capture);
    const v2 = buildSemanticPacket(capture, "draft-semantic-v2");
    expect(v1.rubricVersion).toBe("draft-semantic-v1");
    expect(v2.rubricVersion).toBe("draft-semantic-v2");
    expect(v2.captureHash).toBe(v1.captureHash);
    expect(v2.packetHash).not.toBe(v1.packetHash);
    expect(() => summarizeSemanticReviews(capture, [review(v1.packetHash, "a"), review(v1.packetHash, "b")], "draft-semantic-v2")).toThrow();
    const report = summarizeSemanticReviews(capture, [review(v2.packetHash, "a"), review(v2.packetHash, "b")], "draft-semantic-v2");
    expect(report.rubricVersion).toBe("draft-semantic-v2");
    expect(() => buildSemanticPacket(capture, "unknown" as "draft-semantic-v2")).toThrow();
  });
  it("produces deterministic neutral packets with complete context and visible excluded failures", () => {
    const packet = buildSemanticPacket(capture);
    expect(packet).toEqual(buildSemanticPacket(capture));
    expect(packet.responses[0]?.context).toEqual(context);
    expect(packet.responses[0]?.sentences[0]?.text).toBe("No hay descuentos.");
    expect(packet.excluded).toEqual([{ responseId: "response-1-2", outcome: "error" }]);
    expect(JSON.stringify(packet)).not.toContain("original-case");
  });
  it("binds both context and exact output, including changes with equal sentence counts", () => {
    const before = buildSemanticPacket(capture);
    const changed = structuredClone(capture); changed.cases[0]!.attempts[0]!.output!.sentences[0]!.text = "Hay descuentos.";
    expect(buildSemanticPacket(changed).packetHash).not.toBe(before.packetHash);
    expect(() => summarizeSemanticReviews(changed, [review(before.packetHash, "a"), review(before.packetHash, "b")])).toThrow();
  });
  it("preserves rationales and reports agreement without claiming truth or human adjudication", () => {
    const packet = buildSemanticPacket(capture);
    const result = summarizeSemanticReviews(capture, [review(packet.packetHash, "a"), review(packet.packetHash, "b")]);
    expect(result.responses[0]?.sentences[0]).toMatchObject({ index: 0, support: "unsupported", citations: "none" });
    expect(result.reviews[0]?.responses[0]?.sentences[0]?.rationale).toContain("Ausencia");
    expect(result.status).toBe("reviewer_agreement_not_ground_truth");
    expect(result.excluded).toHaveLength(1);
  });
  it("keeps disagreement or explicit uncertainty uncertain per dimension", () => {
    const packet = buildSemanticPacket(capture);
    const a = review(packet.packetHash, "a"); const b = review(packet.packetHash, "b", "supported");
    b.responses[0]!.abstention.label = "uncertain";
    const result = summarizeSemanticReviews(capture, [a, b]);
    expect(result.responses[0]?.sentences[0]?.support).toBe("uncertain");
    expect(result.responses[0]?.sentences[0]?.citations).toBe("none");
    expect(result.responses[0]?.abstention).toBe("uncertain");
    expect(result.disagreements).toBe(2);
  });
  it("requires exactly two distinct declared reviewers and full nonduplicated coverage", () => {
    const hash = buildSemanticPacket(capture).packetHash; const a = review(hash, "a");
    expect(() => summarizeSemanticReviews(capture, [a])).toThrow();
    expect(() => summarizeSemanticReviews(capture, [a, a])).toThrow();
    const missing = review(hash, "b"); missing.responses[0]!.sentences = [];
    expect(() => summarizeSemanticReviews(capture, [a, missing])).toThrow();
    const duplicate = review(hash, "b"); duplicate.responses.push(duplicate.responses[0]!);
    expect(() => summarizeSemanticReviews(capture, [a, duplicate])).toThrow();
  });
  it("rejects unknown evidence IDs, invalid labels, blank rationales and contradictory citation presence", () => {
    const hash = buildSemanticPacket(capture).packetHash; const a = review(hash, "a");
    for (const patch of [{ evidenceIds: ["unknown"] }, { support: "perfect" }, { rationale: " " }, { citations: "applicable" }, { index: 9 }]) {
      const b = review(hash, "b"); Object.assign(b.responses[0]!.sentences[0]!, patch);
      expect(() => summarizeSemanticReviews(capture, [a, b])).toThrow();
    }
  });
  it("rejects a supplied incomplete capture before preparing review material", () => {
    expect(() => buildSemanticPacket({ ...capture, capture: { complete: false } })).toThrow();
  });
});
