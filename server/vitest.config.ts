import { defineConfig } from "vitest/config";
import { testDatabaseName, testDatabaseUrl } from "./test/db.js";

// Checked here too: a throw in global-setup hides its message in Vitest's error output.
testDatabaseName(testDatabaseUrl);

export default defineConfig({
  test: {
    globalSetup: ["test/global-setup.ts"],
    include: ["test/**/*.test.ts"],
    // Test files share one database, so they run one at a time.
    fileParallelism: false,
  },
});
