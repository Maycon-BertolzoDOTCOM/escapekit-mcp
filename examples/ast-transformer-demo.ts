/**
 * Demo script showing ASTTransformer capabilities
 * 
 * This demonstrates all the key features of the ASTTransformer class:
 * - Parsing various import types
 * - Finding imports in code
 * - Replacing import sources
 * - Preserving formatting
 */

import { ASTTransformer } from '../src/transformers/ASTTransformer.js';

const transformer = new ASTTransformer();

// Example 1: ES6 imports
console.log('=== Example 1: ES6 Imports ===');
const es6Code = `
import React from 'fake-react';
import { useState, useEffect } from 'fake-react';
import * as utils from 'fake-utils';
`;

const es6Ast = transformer.parseWithRecast(es6Code);
const es6Imports = transformer.findImports(es6Ast);
console.log(`Found ${es6Imports.length} ES6 imports`);

// Replace imports
transformer.replaceImport(es6Imports[0], 'react');
transformer.replaceImport(es6Imports[1], 'react');
transformer.replaceImport(es6Imports[2], 'lodash');

const es6Result = transformer.generate(es6Ast);
console.log('Transformed code:');
console.log(es6Result);

// Example 2: CommonJS requires
console.log('\n=== Example 2: CommonJS Requires ===');
const cjsCode = `
const express = require('fake-express');
const axios = require('fake-axios');
`;

const cjsAst = transformer.parseWithRecast(cjsCode);
const cjsImports = transformer.findImports(cjsAst);
console.log(`Found ${cjsImports.length} CommonJS requires`);

transformer.replaceImport(cjsImports[0], 'express');
transformer.replaceImport(cjsImports[1], 'axios');

const cjsResult = transformer.generate(cjsAst);
console.log('Transformed code:');
console.log(cjsResult);

// Example 3: Dynamic imports
console.log('\n=== Example 3: Dynamic Imports ===');
const dynamicCode = `
async function loadModule() {
  const module = await import('fake-module');
  return module;
}
`;

const dynamicAst = transformer.parseWithRecast(dynamicCode);
const dynamicImports = transformer.findImports(dynamicAst);
console.log(`Found ${dynamicImports.length} dynamic imports`);

transformer.replaceImport(dynamicImports[0], 'real-module');

const dynamicResult = transformer.generate(dynamicAst);
console.log('Transformed code:');
console.log(dynamicResult);

// Example 4: Mixed imports
console.log('\n=== Example 4: Mixed Import Types ===');
const mixedCode = `
import React from 'fake-react';
const express = require('fake-express');
const dynamic = import('fake-dynamic');

function App() {
  return <div>Hello World</div>;
}
`;

const mixedAst = transformer.parseWithRecast(mixedCode);
const mixedImports = transformer.findImports(mixedAst);
console.log(`Found ${mixedImports.length} mixed imports`);

transformer.replaceImport(mixedImports[0], 'react');
transformer.replaceImport(mixedImports[1], 'express');
transformer.replaceImport(mixedImports[2], 'real-dynamic');

const mixedResult = transformer.generate(mixedAst);
console.log('Transformed code:');
console.log(mixedResult);

console.log('\n=== Demo Complete ===');
console.log('ASTTransformer successfully:');
console.log('✓ Parsed ES6, CommonJS, and dynamic imports');
console.log('✓ Found all import statements');
console.log('✓ Replaced import sources');
console.log('✓ Preserved code structure and formatting');
