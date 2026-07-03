/**
 * Kiwi TCMS JSON-RPC Client
 * Wraps Kiwi TCMS v15.x JSON-RPC API to match the KiwiClient interface
 */

import axios, { AxiosInstance } from 'axios';
import { RetryHandler, CircuitBreaker, createRetryHandler, createCircuitBreaker } from './retry';
import { getLogger } from './logger';

export interface KiwiRawResult {
  id: number;
  name?: string;
  summary?: string;
  product?: number;
  [key: string]: unknown;
}

export interface KiwiClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  retries?: number;
}

export interface TestCaseData {
  summary: string;
  product: number;
  category: number;
  case_status?: number;
  priority?: number;
  is_automated?: boolean;
  notes?: string;
}

export interface TestRunData {
  summary: string;
  plan: number;
  build: number;
  manager?: number;
  notes?: string;
}

export interface TestExecutionData {
  case: number;
  run: number;
  build: number;
  status: number;
  case_text_version?: number;
  comment?: string;
  sortkey?: number;
}

export interface BuildData {
  name: string;
  product: number;
  version?: number;
  is_active?: boolean;
}

export interface KiwiProduct {
  id: number;
  name: string;
}

export interface KiwiTestCase {
  id: number;
  summary: string;
  category?: number;
}

export interface KiwiTestRun {
  id: number;
  summary: string;
  plan?: number;
  build?: number;
}

export interface KiwiBuild {
  id: number;
  name: string;
}

export interface KiwiCategory {
  id: number;
  name: string;
  product?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class KiwiClient {
  private http: AxiosInstance;
  private authToken: string | null = null;
  private retryHandler: RetryHandler;
  private circuitBreaker: CircuitBreaker;
  private logger = getLogger();
  private requestId = 0;

  // Cache
  private testCaseCache = new Map<string, CacheEntry<KiwiTestCase>>();
  private productCache: CacheEntry<KiwiProduct[]> | null = null;
  private categoryCache = new Map<number, CacheEntry<KiwiCategory[]>>();
  private statusMapCache: CacheEntry<Record<string, number>> | null = null;
  private buildCache = new Map<number, CacheEntry<KiwiBuild[]>>();
  private validatedProducts = new Set<number>();
  private validatedCategories = new Set<string>();

  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly JSONRPC_URL: string;

  constructor(private config: KiwiClientConfig) {
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    this.JSONRPC_URL = `${baseUrl}/json-rpc/`;

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: config.timeout || 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.retryHandler = createRetryHandler({
      maxRetries: config.retries ?? 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.25,
    });

    this.circuitBreaker = createCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 30000,
    });

    this.logger.debug(`KiwiClient (JSON-RPC) initialized: ${baseUrl}`);
  }

  // ─── Cache helpers ──────────────────────────────────────

  private getFromCache<T>(entry: CacheEntry<T> | null | undefined): T | null {
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  }

  private setCache<T>(data: T): CacheEntry<T> {
    return { data, expiresAt: Date.now() + this.CACHE_TTL_MS };
  }

  clearCache(): void {
    this.testCaseCache.clear();
    this.productCache = null;
    this.categoryCache.clear();
    this.statusMapCache = null;
    this.buildCache.clear();
    this.validatedProducts.clear();
    this.validatedCategories.clear();
  }

  getCacheStats(): { testCases: number; products: boolean; categories: number; builds: number } {
    return {
      testCases: this.testCaseCache.size,
      products: this.productCache !== null,
      categories: this.categoryCache.size,
      builds: this.buildCache.size,
    };
  }

  // ─── JSON-RPC Core ─────────────────────────────────────

  async jsonrpc<T>(method: string, params?: unknown[] | Record<string, unknown>): Promise<T> {
    this.requestId++;
    const payload = {
      jsonrpc: '2.0',
      method,
      params: params || [],
      id: this.requestId,
    };

    return this.circuitBreaker.execute(() =>
      this.retryHandler.execute(async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.authToken) {
          headers['Cookie'] = `sessionid=${this.authToken}`;
        }

        const response = await this.http.post(this.JSONRPC_URL, payload, { headers });

        if (response.data.error) {
          throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
        }

        return response.data.result;
      }, `JSON-RPC ${method}`)
    );
  }

  // ─── Auth ───────────────────────────────────────────────

  async authenticate(): Promise<boolean> {
    try {
      const result = await this.jsonrpc<string>('Auth.login', [
        this.config.username,
        this.config.password,
      ]);
      this.authToken = result;
      this.logger.info('Authenticated to Kiwi TCMS (JSON-RPC)');
      return true;
    } catch (error) {
      this.logger.error('Kiwi TCMS authentication failed', { error });
      return false;
    }
  }

  private async ensureAuth(): Promise<void> {
    if (!this.authToken) {
      const ok = await this.authenticate();
      if (!ok) throw new Error('Authentication failed');
    }
  }

  // ─── TestCases ──────────────────────────────────────────

  async findTestCase(summary: string): Promise<KiwiTestCase | undefined> {
    await this.ensureAuth();

    const cached = this.testCaseCache.get(summary);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    try {
      const results = await this.jsonrpc<KiwiRawResult[]>('TestCase.filter', [{ summary }]);
      if (results.length > 0) {
        const tc: KiwiTestCase = { 
          id: results[0].id, 
          summary: results[0].summary !== undefined ? results[0].summary : String(results[0].summary) 
        };
        this.testCaseCache.set(summary, this.setCache(tc));
        return tc;
      }
    } catch (error) {
      this.logger.debug(`TestCase.filter failed: ${error}`);
    }
    return undefined;
  }

  async createTestCase(data: TestCaseData): Promise<KiwiTestCase> {
    await this.ensureAuth();

    const result = await this.jsonrpc<KiwiRawResult>('TestCase.create', [data]);
    const tc: KiwiTestCase = { 
      id: result.id, 
      summary: result.summary !== undefined ? result.summary : String(result.summary) 
    };
    this.testCaseCache.set(data.summary, this.setCache(tc));
    return tc;
  }

  async getOrCreateTestCase(
    summary: string,
    productId: number,
    categoryId: number
  ): Promise<KiwiTestCase> {
    const cached = this.testCaseCache.get(summary);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    const existing = await this.findTestCase(summary);
    if (existing) return existing;

    await this.validateProduct(productId);
    await this.validateCategory(productId, categoryId);

    return this.createTestCase({
      summary,
      product: productId,
      category: categoryId,
      case_status: 2, // CONFIRMED
      priority: 1, // P1
      is_automated: true,
    });
  }

  // ─── Validation ─────────────────────────────────────────

  async validateProduct(productId: number): Promise<KiwiProduct> {
    if (this.validatedProducts.has(productId)) {
      const products = this.getFromCache(this.productCache) || (await this.listProducts());
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error(`Product ID ${productId} not found`);
      return product;
    }

    const products = await this.listProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      const available = products.map(p => `${p.name !== undefined ? p.name : String(p.name)} (ID: ${p.id})`).join(', ');
      throw new Error(`Product ID ${productId} not found. Available: ${available || 'none'}`);
    }

    this.validatedProducts.add(productId);
    return product;
  }

  async validateCategory(productId: number, categoryId: number): Promise<KiwiCategory> {
    const key = `${productId}:${categoryId}`;
    if (this.validatedCategories.has(key)) {
      const categories =
        this.getFromCache(this.categoryCache.get(productId)) ||
        (await this.listCategories(productId));
      const category = categories.find(c => c.id === categoryId);
      if (!category) throw new Error(`Category ID ${categoryId} not found`);
      return category;
    }

    const categories = await this.listCategories(productId);
    const category = categories.find(c => c.id === categoryId);

    if (!category) {
      const available = categories.map(c => `${c.name !== undefined ? c.name : String(c.name)} (ID: ${c.id})`).join(', ');
      throw new Error(
        `Category ID ${categoryId} not found for product ${productId}. Available: ${available || 'none'}`
      );
    }

    this.validatedCategories.add(key);
    return category;
  }

  // ─── TestRuns ───────────────────────────────────────────

  async createTestRun(data: TestRunData): Promise<KiwiTestRun> {
    await this.ensureAuth();
    const result = await this.jsonrpc<KiwiRawResult>('TestRun.create', [data]);
    return { 
      id: result.id, 
      summary: result.summary !== undefined ? result.summary : String(result.summary) 
    };
  }

  async addTestCaseToRun(runId: number, caseId: number): Promise<void> {
    await this.ensureAuth();
    await this.jsonrpc('TestRun.add_case', [runId, caseId]);
  }

  // ─── TestExecutions ────────────────────────────────────

  async addTestExecution(data: TestExecutionData): Promise<KiwiRawResult> {
    await this.ensureAuth();

    // Step 1: Add test case to the run (idempotent)
    try {
      await this.jsonrpc('TestRun.add_case', [data.run, data.case]);
    } catch (error: unknown) {
      // Case may already be in the run, ignore "already exists" errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already')) {
        this.logger.debug(`add_case error (may be already added): ${errorMessage}`);
      }
    }

    // Step 2: Find the execution ID
    const executions = await this.jsonrpc<KiwiRawResult[]>('TestExecution.filter', [
      {
        run: data.run,
        case: data.case,
      },
    ]);

    if (executions.length === 0) {
      throw new Error(`No test execution found for run=${data.run}, case=${data.case}`);
    }

    // Step 3: Update the execution with status
    const executionId = executions[0].id;
    return this.jsonrpc('TestExecution.update', [
      executionId,
      {
        status: data.status,
        build: data.build,
        case_text_version: data.case_text_version || 1,
        comment: data.comment || '',
      },
    ]);
  }

  async updateTestExecution(executionId: number, data: Partial<TestExecutionData>): Promise<KiwiRawResult> {
    await this.ensureAuth();
    return this.jsonrpc('TestExecution.update', [[executionId], data]);
  }

  // ─── Builds ─────────────────────────────────────────────

  async listBuilds(productId: number): Promise<KiwiBuild[]> {
    await this.ensureAuth();

    const cached = this.buildCache.get(productId);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    try {
      const results = await this.jsonrpc<KiwiRawResult[]>('Build.filter', [{ version__product: productId }]);
      const builds = results.map(b => ({ id: b.id, name: b.name !== undefined ? b.name : String(b.name) }));
      this.buildCache.set(productId, this.setCache(builds));
      return builds;
    } catch {
      return [];
    }
  }

  async createBuild(data: BuildData): Promise<KiwiBuild> {
    await this.ensureAuth();
    const result = await this.jsonrpc<KiwiRawResult>('Build.create', [data]);
    this.buildCache.delete(data.product);
    return { id: result.id, name: result.name !== undefined ? result.name : String(result.name) };
  }

  async getOrCreateBuild(
    productId: number,
    buildName: string,
    versionId?: number
  ): Promise<KiwiBuild> {
    await this.ensureAuth();

    // Search all builds (Kiwi JSON-RPC Build.filter doesn't filter by product reliably)
    try {
      const allBuilds = await this.jsonrpc<KiwiRawResult[]>('Build.filter', [{}]);
      const existing = allBuilds.find(b => b.name === buildName);
      if (existing) return { id: existing.id, name: existing.name !== undefined ? existing.name : String(existing.name) };
    } catch {
      /* ignore */
    }

    const data: BuildData = {
      name: buildName,
      product: productId,
      is_active: true,
    };
    if (versionId) data.version = versionId;

    return this.createBuild(data);
  }

  // ─── Products ───────────────────────────────────────────

  async listProducts(): Promise<KiwiProduct[]> {
    const cached = this.getFromCache(this.productCache);
    if (cached) return cached;

    await this.ensureAuth();
    const results = await this.jsonrpc<KiwiRawResult[]>('Product.filter', [{}]);
    const products = results.map(p => ({ id: p.id, name: p.name !== undefined ? p.name : String(p.name) }));
    this.productCache = this.setCache(products);
    return products;
  }

  async findProductByName(name: string): Promise<KiwiProduct | undefined> {
    const products = await this.listProducts();
    return products.find(p => p.name === name);
  }

  async findProductById(id: number): Promise<KiwiProduct | undefined> {
    const products = await this.listProducts();
    return products.find(p => p.id === id);
  }

  // ─── Categories ─────────────────────────────────────────

  async listCategories(productId: number): Promise<KiwiCategory[]> {
    await this.ensureAuth();

    const cached = this.categoryCache.get(productId);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    const results = await this.jsonrpc<KiwiRawResult[]>('Category.filter', [{ product: productId }]);
    const categories = results.map(c => ({ 
      id: c.id, 
      name: c.name !== undefined ? c.name : String(c.name),
      product: c.product !== undefined ? Number(c.product) : undefined
    }));
    this.categoryCache.set(productId, this.setCache(categories));
    return categories;
  }

  async getDefaultCategoryId(productId: number): Promise<number> {
    const categories = await this.listCategories(productId);
    if (categories.length > 0) return categories[0].id;

    this.logger.warn(`No categories found for product ${productId}, creating default`);
    await this.ensureAuth();
    const result = await this.jsonrpc<KiwiRawResult>('Category.create', [
      { name: 'Default', product: productId },
    ]);
    this.categoryCache.delete(productId);
    return result.id;
  }

  // ─── Versions ───────────────────────────────────────────

  async getOrCreateVersion(productId: number, versionValue: string): Promise<number> {
    await this.ensureAuth();

    try {
      const results = await this.jsonrpc<KiwiRawResult[]>('Version.filter', [
        { product: productId, value: versionValue },
      ]);
      if (results.length > 0) return results[0].id;
    } catch {
      /* ignore */
    }

    const result = await this.jsonrpc<KiwiRawResult>('Version.create', [
      { product: productId, value: versionValue },
    ]);
    return result.id;
  }

  // ─── Status Map ─────────────────────────────────────────

  async getStatusMap(): Promise<Record<string, number>> {
    const cached = this.getFromCache(this.statusMapCache);
    if (cached) return cached;

    await this.ensureAuth();
    const statuses = await this.jsonrpc<KiwiRawResult[]>('TestExecutionStatus.filter', [{}]);
    const map: Record<string, number> = {};

    for (const s of statuses) {
      if (s.name) {
        const key = s.name.toLowerCase();
        if (key === 'passed') map['passed'] = s.id;
        if (key === 'failed') map['failed'] = s.id;
        if (key === 'idle') map['skipped'] = s.id;
        if (key === 'waived') map['waived'] = s.id;
      }
    }

    if (!map['passed']) map['passed'] = 2;
    if (!map['failed']) map['failed'] = 3;
    if (!map['skipped']) map['skipped'] = 1;

    this.statusMapCache = this.setCache(map);
    return map;
  }

  // ─── Utilities ──────────────────────────────────────────

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  getRetryHistory() {
    return this.retryHandler.getHistory();
  }
}
