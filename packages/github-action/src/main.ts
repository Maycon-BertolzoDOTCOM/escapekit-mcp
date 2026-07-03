import * as core from '@actions/core';
import * as github from '@actions/github';
import { ConfigLoader } from './ConfigLoader';
import { CheckRunner } from './CheckRunner';
import { PRCommentBuilder } from './PRCommentBuilder';

async function run(): Promise<void> {
  try {
    // Load config
    const config = await ConfigLoader.load(core.getInput('config-path'));
    
    // Run analysis
    const runner = new CheckRunner(config);
    const result = await runner.execute();
    
    // Post comment
    const commentBuilder = new PRCommentBuilder();
    await commentBuilder.postComment(result);
    
    // Set outputs
    core.setOutput('risk-level', result.riskLevel);
    core.setOutput('report-hash', result.fileResults.length > 0 
      ? commentBuilder.generateReportHash(result) 
      : 'none');
    
    // Set check status
    if (['high', 'critical'].includes(result.riskLevel) && 
        result.riskLevel >= config.failureThreshold) {
      core.setFailed(`Code contains ${result.riskLevel} risk issues`);
    } else {
      core.info(`Analysis completed with ${result.riskLevel} risk level`);
    }
    
  } catch (error) {
    // Graceful error handling
    const message = error instanceof Error ? error.message : String(error);
    core.error(message);
    
    // Create job summary
    await core.summary
      .addHeading('CodeMemória Analysis Failed')
      .addRaw(message)
      .write();
      
    core.setFailed(message);
  }
}

run();