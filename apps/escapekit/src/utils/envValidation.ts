/**
 * Environment Variable Validation
 *
 * Validates environment variables with bounds checking.
 * Inspired by Claude Code's utils/envValidation.ts.
 *
 * Usage:
 *   import { validateBoundedInt, validateBool, validateEnum } from './utils/envValidation.js'
 *
 *   const result = validateBoundedInt('MAX_RETRIES', process.env.MAX_RETRIES, 3, 0, 10)
 *   console.log(result.effective)  // 3 (default) or the validated value
 */

export type ValidationResult = {
  effective: number;
  status: 'valid' | 'capped' | 'invalid';
  message?: string;
};

export type BoolResult = {
  effective: boolean;
  status: 'valid' | 'invalid';
  message?: string;
};

export type EnumResult<T extends string> = {
  effective: T;
  status: 'valid' | 'invalid';
  message?: string;
};

/**
 * Validate a bounded integer environment variable.
 *
 * Returns the validated value capped to [lowerLimit, upperLimit].
 * Logs warnings for invalid or capped values.
 */
export function validateBoundedInt(
  name: string,
  value: string | undefined,
  defaultValue: number,
  lowerLimit: number = 0,
  upperLimit: number = Number.MAX_SAFE_INTEGER,
): ValidationResult {
  if (!value) {
    return { effective: defaultValue, status: 'valid' };
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return {
      effective: defaultValue,
      status: 'invalid',
      message: `${name}: Invalid value "${value}" (using default: ${defaultValue})`,
    };
  }

  if (parsed < lowerLimit) {
    return {
      effective: lowerLimit,
      status: 'capped',
      message: `${name}: Capped from ${parsed} to lower limit ${lowerLimit}`,
    };
  }

  if (parsed > upperLimit) {
    return {
      effective: upperLimit,
      status: 'capped',
      message: `${name}: Capped from ${parsed} to upper limit ${upperLimit}`,
    };
  }

  return { effective: parsed, status: 'valid' };
}

/**
 * Validate a boolean environment variable.
 *
 * Accepts: 'true', '1', 'yes' → true; 'false', '0', 'no' → false
 */
export function validateBool(
  name: string,
  value: string | undefined,
  defaultValue: boolean,
): BoolResult {
  if (!value) {
    return { effective: defaultValue, status: 'valid' };
  }

  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return { effective: true, status: 'valid' };
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return { effective: false, status: 'valid' };
  }

  return {
    effective: defaultValue,
    status: 'invalid',
    message: `${name}: Invalid boolean "${value}" (using default: ${defaultValue})`,
  };
}

/**
 * Validate an enum environment variable.
 */
export function validateEnum<T extends string>(
  name: string,
  value: string | undefined,
  defaultValue: T,
  allowedValues: readonly T[],
): EnumResult<T> {
  if (!value) {
    return { effective: defaultValue, status: 'valid' };
  }

  if (allowedValues.includes(value as T)) {
    return { effective: value as T, status: 'valid' };
  }

  return {
    effective: defaultValue,
    status: 'invalid',
    message: `${name}: Invalid value "${value}" (allowed: ${allowedValues.join(', ')}; using default: ${defaultValue})`,
  };
}

/**
 * Validate a URL environment variable.
 */
export function validateUrl(
  name: string,
  value: string | undefined,
  defaultValue: string,
): { effective: string; status: 'valid' | 'invalid'; message?: string } {
  if (!value) {
    return { effective: defaultValue, status: 'valid' };
  }

  try {
    new URL(value);
    return { effective: value, status: 'valid' };
  } catch {
    return {
      effective: defaultValue,
      status: 'invalid',
      message: `${name}: Invalid URL "${value}" (using default: ${defaultValue})`,
    };
  }
}
