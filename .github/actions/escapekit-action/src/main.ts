import * as core from '@actions/core';
import { runEscapeKit } from 'escapekit';

async function run() {
  try {
    const configPath = core.getInput('config-path');
    const results = await runEscapeKit({ configPath });
    
    core.setOutput('results', JSON.stringify(results));
    
    if (results.errors > 0) {
      core.setFailed(`EscapeKit found ${results.errors} critical issues`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();