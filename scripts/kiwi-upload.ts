#!/usr/bin/env ts-node

import { join } from "path";
const { loadTestResults } = require("./load-test-results");

export async function uploadResults(options: any): Promise<void> {
  console.log("Starting Kiwi TCMS upload...");
  const results = await loadTestResults({
    source: options.file,
    framework: options.framework,
  });
  console.log(`Loaded ${results.length} test results`);
}

if (require.main === module) {
  uploadResults({ file: "test-results.json" })
    .then(() => process.exit(0))
    .catch((err: any) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
