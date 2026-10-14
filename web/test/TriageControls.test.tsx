import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TriageControls } from "../src/components/TriageControls.js";
import { fakeApi } from "./fake-api.js";

describe("TriageControls scope", () => {
  it("describes global scope and token use on both actions without running on mount", async () => {
    const triage = vi.fn(async () => ({ triaged: 2, failed: 0 }));
    render(<TriageControls api={fakeApi({ triage })} pending={1} failed={1} onDone={() => {}} />);
    const classify = screen.getByRole("button", { name: "Clasificar" });
    const retry = screen.getByRole("button", { name: "Reintentar fallidas" });
    for (const button of [classify, retry]) {
      expect(button).toHaveAccessibleDescription(/Los filtros no limitan el alcance/);
      expect(button).toHaveAccessibleDescription(/consumen tokens/);
    }
    expect(triage).not.toHaveBeenCalled();
    await userEvent.click(retry);
    expect(triage).toHaveBeenCalledWith({ retryFailed: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Clasificadas: 2");
  });
});
