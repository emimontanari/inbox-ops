import { defineConfig } from "vitest/config";

// Backend tests only; the web app in web/ has its own Vitest setup with a browser-like DOM.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
