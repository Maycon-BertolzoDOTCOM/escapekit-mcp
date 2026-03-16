/**
 * Mocha Test Adapter
 * Parses Mocha XML output (xunit reporter) and converts to Kiwi TCMS format
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

export class MochaAdapter implements TestAdapter {
  private config: AdapterConfig;

  constructor(config: AdapterConfig = {}) {
    this.config = {
      includeSkipped: true,
      includeTodo: true,
      stripAnsiColors: true,
      maxDuration: 60000,
      ...config,
    };
  }

  getFrameworkName(): string {
    return 'mocha';
  }

  canHandle(source: string): boolean {
    if (source.endsWith('.xml')) {
      try {
        const content = readFileSync(source, 'utf-8');
        return content.includes('<testsuite') || content.includes('<testsuites>');
      } catch {
        return false;
      }
    }
    return source.includes('<testsuite') || source.includes('<testsuites>');
  }

  async load(source: string): Promise<TestResult[]> {
    let content: string;

    try {
      content = source.endsWith('.xml')
        ? readFileSync(source, 'utf-8')
        : source;
    } catch (error) {
      throw new Error(`Failed to read Mocha XML: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      return this.parseXML(content);
    } catch (error) {
      throw new Error(`Failed to parse Mocha XML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseXML(xml: string): TestResult[] {
    const results: TestResult[] = [];

    // Parse testsuites or testsuite
    const testsuitesMatch = xml.match(/<testsuites[^>]*>([\s\S]*)<\/testsuites>/);
    if (testsuitesMatch) {
      const inner = testsuitesMatch[1];
      const suites = inner.match(/<testsuite[^>]*>([\s\S]*?)<\/testsuite>/g) || [];
      for (const suite of suites) {
        results.push(...this.parseTestSuite(suite));
      }
    } else {
      const testsuiteMatch = xml.match(/<testsuite[^>]*>([\s\S]*)<\/testsuite>/);
      if (testsuiteMatch) {
        results.push(...this.parseTestSuite(testsuiteMatch[0]));
      }
    }

    return results.filter(result => {
      if (result.outcome === 'skipped' && !this.config.includeSkipped) {
        return false;
      }
      if (result.metadata?.isTodo && !this.config.includeTodo) {
        return false;
      }
      return true;
    });
  }

  private parseTestSuite(suiteXML: string): TestResult[] {
    const results: TestResult[] = [];

    // Extract suite attributes
    const suiteNameMatch = suiteXML.match(/<testsuite[^>]*name="([^"]*)"/);
    const suiteName = suiteNameMatch ? suiteNameMatch[1] : 'Unknown Suite';

    // Parse test cases - match all <testcase> tags (both self-closing and with content)
    const allTestCaseMatches = suiteXML.match(/<testcase\b[^>]*>/g) || [];
    
    for (const testCaseMatch of allTestCaseMatches) {
      const isSelfClosing = testCaseMatch.endsWith('/>');
      const fullTestCaseXML = isSelfClosing 
        ? testCaseMatch 
        : this.extractFullTestCase(suiteXML, testCaseMatch);
      
      const result = this.parseTestCase(fullTestCaseXML, suiteName);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private extractFullTestCase(suiteXML: string, openingTag: string): string {
    // Find position of opening tag
    const startIndex = suiteXML.indexOf(openingTag);
    if (startIndex === -1) return openingTag;
    
    // Find closing </testcase> tag
    const closingTag = '</testcase>';
    const endIndex = suiteXML.indexOf(closingTag, startIndex + openingTag.length);
    
    if (endIndex === -1) return openingTag;
    
    return suiteXML.substring(startIndex, endIndex + closingTag.length);
  }

  private parseTestCase(testCaseXML: string, suiteName: string): TestResult | null {
    // Use more specific regex that matches only the opening tag part
    const nameMatch = testCaseXML.match(/<testcase[^>]*\bname="([^"]*)"/);
    const classnameMatch = testCaseXML.match(/<testcase[^>]*\bclassname="([^"]*)"/);
    const timeMatch = testCaseXML.match(/<testcase[^>]*\btime="([^"]*)"/);

    if (!nameMatch) return null;

    const name = nameMatch[1];
    const classname = classnameMatch ? classnameMatch[1] : suiteName;
    const duration = timeMatch ? parseFloat(timeMatch[1]) * 1000 : 0;

    let outcome: TestResult['outcome'] = 'passed';
    let error: string | undefined;

    // Check for failure tag (non-self-closing)
    if (testCaseXML.includes('<failure')) {
      outcome = 'failed';
      const failureContentMatch = testCaseXML.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
      if (failureContentMatch) {
        error = failureContentMatch[1];
        const failureMessageMatch = testCaseXML.match(/<failure[^>]*message="([^"]*)"/);
        if (failureMessageMatch) {
          error = `${failureMessageMatch[1]}\n\n${error}`;
        }
      }
    } 
    // Check for error tag (non-self-closing)
    else if (testCaseXML.includes('<error')) {
      outcome = 'failed';
      const errorContentMatch = testCaseXML.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      if (errorContentMatch) {
        error = errorContentMatch[1];
        const errorMessageMatch = testCaseXML.match(/<error[^>]*message="([^"]*)"/);
        if (errorMessageMatch) {
          error = `${errorMessageMatch[1]}\n\n${error}`;
        }
      }
    } 
    // Check for skipped tag
    else if (testCaseXML.includes('<skipped')) {
      outcome = 'skipped';
    }

    const maxDuration = this.config.maxDuration || 60000;
    const finalOutcome = duration > maxDuration ? 'failed' : outcome;

    const testResult: TestResult = {
      testCase: this.normalizeTestCaseName(name, classname),
      outcome: finalOutcome,
      duration: Math.round(duration),
      metadata: {
        framework: 'mocha',
        suite: suiteName,
        classname: classname,
        isSkipped: outcome === 'skipped',
      },
    };

    if (error && (finalOutcome === 'failed' || outcome === 'failed')) {
      if (this.config.stripAnsiColors) {
        error = this.stripAnsiColors(error);
      }
      testResult.error = error;
    }

    return testResult;
  }

  private normalizeTestCaseName(name: string, classname: string): string {
    const normalized = name
      .replace(/[\s\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const classPrefix = classname
      .replace(/\s+/g, '-')
      .replace(/[\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    return `${classPrefix}-${normalized}`;
  }

  private stripAnsiColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

export function generateMochaCommand(outputPath: string = 'mocha-results.xml'): string {
  return `npx mocha test/**/*.spec.js --reporter xunit --reporter-options output=${outputPath}`;
}
