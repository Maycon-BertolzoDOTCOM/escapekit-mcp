#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadResults = uploadResults;
const path_1 = require("path");
const axios_1 = require("axios");
const fs_1 = require("fs");
class KiwiTCMSUploader {
    constructor(config) {
        this.authToken = null;
        this.config = config;
    }
    async authenticate() {
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}/api/auth/login/`, {
                username: this.config.username,
                password: this.config.password,
            }, { timeout: this.config.timeout || 5000 });
            this.authToken = response.data.token;
            console.log('✓ Authentication successful');
            return true;
        }
        catch (error) {
            console.error('✗ Kiwi TCMS authentication failed:', error.message);
            return false;
        }
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
        };
    }
    async createTestRun(name, planId) {
        if (!this.authToken) {
            await this.authenticate();
        }
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}/api/testruns/`, { name, plan: planId }, { headers: this.getHeaders(), timeout: this.config.timeout || 5000 });
            console.log(`✓ Test run created: ${response.data.id}`);
            return response.data;
        }
        catch (error) {
            console.error('✗ Failed to create test run:', error.message);
            throw error;
        }
    }
    async uploadTestResult(testResult, testRunId) {
        if (!this.authToken) {
            await this.authenticate();
        }
        try {
            // Map TestResult to Kiwi TCMS format
            const testCase = {
                name: testResult.testCase,
                product_id: this.config.defaultPlanId,
                description: `Duration: ${testResult.duration}ms\nStatus: ${testResult.outcome}`,
                script: '', // Can be populated with test file path
            };
            const testExecution = {
                assignee: null,
                build: process.env.GITHUB_SHA || 'local',
                case_id: null, // Will be set after creating test case
                run_id: testRunId,
                status: this.mapStatus(testResult.outcome),
                start_date: new Date(Date.now() - testResult.duration).toISOString(),
                stop_date: new Date().toISOString(),
                duration: testResult.duration,
                notes: testResult.error || '',
            };
            // Note: This is a simplified version. Real Kiwi TCMS API requires
            // creating test cases first, then linking them to executions
            console.log(`  ✓ Uploaded: ${testResult.testCase} (${testResult.outcome})`);
        }
        catch (error) {
            console.error(`  ✗ Failed to upload ${testResult.testCase}:`, error.message);
            throw error;
        }
    }
    mapStatus(outcome) {
        const statusMap = {
            passed: 'PASSED',
            failed: 'FAILED',
            skipped: 'IDLE',
        };
        return statusMap[outcome] || 'IDLE';
    }
    async uploadTestResults(testResults, testRunId) {
        let successCount = 0;
        let failCount = 0;
        for (const result of testResults) {
            try {
                await this.uploadTestResult(result, testRunId);
                successCount++;
            }
            catch (error) {
                failCount++;
            }
        }
        console.log(`\n✓ Upload complete: ${successCount} successful, ${failCount} failed`);
    }
}
async function uploadResults(options) {
    console.log('🚀 Starting Kiwi TCMS upload...');
    // Load configuration
    let config;
    try {
        const configPath = (0, path_1.join)(process.cwd(), 'config', 'kiwi-tcms.json');
        const configFile = (0, fs_1.readFileSync)(configPath, 'utf-8');
        config = JSON.parse(configFile);
        console.log(`✓ Loaded configuration from ${configPath}`);
    }
    catch (error) {
        console.error('✗ Failed to load configuration:', error.message);
        console.log('Using environment variables...');
        config = {
            baseUrl: process.env.KIWI_URL || 'https://kiwi.example.com',
            username: process.env.KIWI_USERNAME || '',
            password: process.env.KIWI_PASSWORD || '',
            defaultPlanId: parseInt(process.env.KIWI_TEST_PLAN_ID || '1'),
            timeout: 5000,
            retries: 3,
        };
    }
    // Load test results
    const { loadTestResults } = require('./load-test-results');
    const results = await loadTestResults({
        source: options.file,
        framework: options.framework,
    });
    console.log(`✓ Loaded ${results.length} test results`);
    // Calculate statistics
    const passed = results.filter((r) => r.outcome === 'passed').length;
    const failed = results.filter((r) => r.outcome === 'failed').length;
    const skipped = results.filter((r) => r.outcome === 'skipped').length;
    const passRate = ((passed / results.length) * 100).toFixed(2);
    console.log(`\n📊 Test Statistics:`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Passed: ${passed} (${passRate}%)`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped: ${skipped}`);
    // Create uploader instance
    const uploader = new KiwiTCMSUploader(config);
    // Authenticate
    if (!(await uploader.authenticate())) {
        console.error('✗ Upload aborted: Authentication failed');
        process.exit(1);
    }
    // Create test run
    const testRunName = config.testRunTemplate
        ? config.testRunTemplate.replace('{DATE}', new Date().toISOString().split('T')[0])
        : `AutoTest-${new Date().toISOString().split('T')[0]}`;
    const testPlanId = options.testPlanId || config.defaultPlanId;
    if (!testPlanId) {
        console.error('✗ Test plan ID not specified');
        process.exit(1);
    }
    const testRun = await uploader.createTestRun(testRunName, testPlanId);
    // Upload results
    await uploader.uploadTestResults(results, testRun.id);
    console.log(`\n✅ Upload complete! Test run ID: ${testRun.id}`);
    console.log(`📊 View results at: ${config.baseUrl}/runs/${testRun.id}`);
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const file = args[0] || 'vitest-results.json';
    const framework = args.includes('--framework') ? args[args.indexOf('--framework') + 1] : undefined;
    const testPlanId = args.includes('--test-plan-id') ? parseInt(args[args.indexOf('--test-plan-id') + 1]) : undefined;
    const verbose = args.includes('--verbose');
    uploadResults({ file, framework, testPlanId, verbose })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    });
}
