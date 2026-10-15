import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useClock } from "../src/use-clock.js";
afterEach(() => vi.useRealTimers());
it("refreshes every 30 seconds and on focus, and cleans up its timer", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
  const { result, unmount } = renderHook(useClock);
  const start = result.current;
  act(() => vi.advanceTimersByTime(30000));
  expect(result.current).toBe(start + 30000);
  vi.setSystemTime(start + 120000);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current).toBe(start + 120000);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
