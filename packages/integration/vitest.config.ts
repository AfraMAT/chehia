import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests hit the local Supabase stack; run serially.
    fileParallelism: false,
  },
});
