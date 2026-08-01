import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "../hype-engine/src"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
