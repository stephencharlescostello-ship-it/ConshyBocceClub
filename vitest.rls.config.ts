import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests against the local Supabase stack (npm run db:start first).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
