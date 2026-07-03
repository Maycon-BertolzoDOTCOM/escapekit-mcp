/**
 * Hooks package index
 */

export type { HookContext, HookEvent, HookExecutionResult, HookHandler, HookRegistration, HookResult } from './types.js';
export { HookRegistry, hookRegistry, registerHook, unregisterHook, executeHooks } from './registry.js';
export type { RegisterOptions } from './registry.js';
export { MetricsCollector, metricsCollector, registerBuiltinHooks } from './builtin.js';
