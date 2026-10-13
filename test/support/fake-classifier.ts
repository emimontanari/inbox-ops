import type { Classifier, ClassifierResult } from "../../src/application/classifier.js";
import type { SupportRequest } from "../../src/domain/support-request.js";

// Test double: returns a canned response and records every request it receives.
export class FakeClassifier implements Classifier {
  readonly calls: SupportRequest[] = [];

  constructor(private readonly respond: () => Promise<ClassifierResult>) {}

  static returning(result: ClassifierResult): FakeClassifier {
    return new FakeClassifier(async () => result);
  }

  static throwing(error: Error): FakeClassifier {
    return new FakeClassifier(async () => {
      throw error;
    });
  }

  async classify(request: SupportRequest): Promise<ClassifierResult> {
    this.calls.push(request);
    return this.respond();
  }
}
