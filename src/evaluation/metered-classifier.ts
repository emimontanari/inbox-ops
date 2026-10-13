import type { Classifier, TokenUsage } from "../application/classifier.js";

export type Measurement = {
  requestId: string;
  latencyMs: number;
  ok: boolean;
  usage?: TokenUsage;
};

// Decorator: wraps any Classifier to record latency and token usage,
// without changing the classifier or the use case that calls it.
export function createMeteredClassifier(
  inner: Classifier,
  now: () => number = () => performance.now(),
): { classifier: Classifier; measurements: Measurement[] } {
  const measurements: Measurement[] = [];

  const classifier: Classifier = {
    async classify(request) {
      const start = now();
      try {
        const result = await inner.classify(request);
        const latencyMs = now() - start;
        measurements.push(
          result.ok && result.value.usage
            ? { requestId: request.id, latencyMs, ok: true, usage: result.value.usage }
            : { requestId: request.id, latencyMs, ok: result.ok },
        );
        return result;
      } catch (error) {
        measurements.push({ requestId: request.id, latencyMs: now() - start, ok: false });
        throw error;
      }
    },
  };

  return { classifier, measurements };
}
