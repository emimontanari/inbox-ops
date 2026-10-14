import type { DraftContext, DrafterResult, ReplyDrafter } from "../../src/application/reply-drafter.js";

// Test double: returns a canned draft and records the context of every call.
export class FakeDrafter implements ReplyDrafter {
  readonly calls: DraftContext[] = [];

  constructor(private readonly respond: () => Promise<DrafterResult>) {}

  static returning(result: DrafterResult): FakeDrafter {
    return new FakeDrafter(async () => result);
  }

  async draft(context: DraftContext): Promise<DrafterResult> {
    this.calls.push(context);
    return this.respond();
  }
}
