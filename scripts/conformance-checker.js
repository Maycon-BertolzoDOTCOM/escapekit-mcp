#!/usr/bin/env node
// scripts/conformance-checker.js
// EscapeKit Monorepo Conformance Checker v1.0
'use strict';
const { readFileSync, existsSync, readdirSync, statSync } = require('node:fs');
const { join, resolve, relative, dirname } = require('node:path');

function findRoot(startDir) {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        if (pkg.workspaces) return dir;
      } catch (_) {}
    }
    dir = dirname(dir);
  }
  return null;
}

const ROOT = findRoot(process.cwd()) || findRoot(__dirname);
if (!ROOT) {
  process.stderr.write('Erro: Nao foi possivel determinar a Workspace_Root\n');
  process.exit(2);
}

const violations = [];
function addViolation(rule, severity, filePath, message, category) {
  violations.push({ rule, severity, path: relative(ROOT, filePath) || filePath, message, category });
}

function safeReadFile(fp) {
  try { return readFileSync(fp, 'utf8'); }
  catch (_) { addViolation('READ_ERR', 'info', fp, 'Nao foi possivel ler o arquivo', 'read-error'); return null; }
}
function safeReadJSON(fp) {
  const c = safeReadFile(fp);
  if (!c) return null;
  try { return JSON.parse(c); }
  catch (_) { addViolation('PARSE_ERR', 'info', fp, 'Nao foi possivel parsear JSON', 'read-error'); return null; }
}
function listDir(dir) { try { return readdirSync(dir); } catch (_) { return []; } }
function isDir(p) { try { return statSync(p).isDirectory(); } catch (_) { return false; } }
function isFile(p) { try { return statSync(p).isFile(); } catch (_) { return false; } }

const GOVERNANCE_DIRS = new Set([
  '.git','node_modules','.github','.kiro','.vscode','.idea',
  'scripts','docs','archive','apps','packages',
  '.comate','.qoder','.ruff_cache','.venv-ascii','.ai-templates',
]);
const GOVERNANCE_FILES = new Set([
  'package.json','package-lock.json','tsconfig.json','tsconfig.base.json',
  '.eslintrc.json','.prettierrc.json','.gitignore','README.md','LICENSE',
  'CHANGELOG.md','CONTRIBUTING.md','MIGRATION_STATUS.md','.env.example',
  '.railway.env.example','.cursorrules','railway.yml','railway-template.json',
  'docker-compose.kiwi.yml','.gitlab-ci.yml','vitest.config.ts',
]);

function checkTopology() {
  for (const entry of listDir(ROOT)) {
    const ep = join(ROOT, entry);
    if (isDir(ep)) {
      if (!GOVERNANCE_DIRS.has(entry))
        addViolation('TOPOLOGY_001','critical',ep,"Dir nao governado na raiz: '"+entry+"/'","topology");
    } else {
      if (!GOVERNANCE_FILES.has(entry))
        addViolation('TOPOLOGY_001','critical',ep,"Arquivo nao governado na raiz: '"+entry+"'","topology");
    }
  }
}

function checkMigrationResidues() {
  if (isDir(join(ROOT,'qwen-escapekit')))
    addViolation('TOPOLOGY_002','critical',join(ROOT,'qwen-escapekit'),
      'Residuo de migracao na raiz. Mover para apps/qwen-escapekit','migration-residue');
  if (isDir(join(ROOT,'pisosrealview-pro-transformed')))
    addViolation('TOPOLOGY_003','critical',join(ROOT,'pisosrealview-pro-transformed'),
      'Residuo de migracao na raiz. Mover para apps/experimental/pisosrealview-pro-transformed','migration-residue');
}

function checkStaleArtifacts() {
  for (const [name, rule, sev] of [['dist','ARTIFACT_001','critical'],['coverage','ARTIFACT_002','warning'],['logs','ARTIFACT_003','warning']]) {
    if (isDir(join(ROOT, name)))
      addViolation(rule, sev, join(ROOT, name), "Artefato '"+name+"/' na Workspace_Root. Deve estar dentro de workspaces.", 'stale-artifact');
  }
}

function checkFragileDeps() {
  function checkPkg(pkgPath) {
    const pkg = safeReadJSON(pkgPath);
    if (!pkg) return;
    const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    for (const [n, v] of Object.entries(deps)) {
      if (typeof v === 'string' && v.includes('file:') && v.includes('dist'))
        addViolation('DEP_001','critical',pkgPath,'Dep fragil: "'+n+'": "'+v+'". Use "@escapekit/core": "*"','fragile-dep');
    }
  }
  for (const ws of ['apps','packages']) {
    const wsDir = join(ROOT, ws);
    if (!isDir(wsDir)) continue;
    for (const e of listDir(wsDir)) {
      const ep = join(wsDir, e);
      if (!isDir(ep)) continue;
      if (isFile(join(ep,'package.json'))) checkPkg(join(ep,'package.json'));
      for (const s of listDir(ep)) {
        const sp = join(ep, s);
        if (isDir(sp) && isFile(join(sp,'package.json'))) checkPkg(join(sp,'package.json'));
      }
    }
  }
}

function checkCrossBoundaryImports() {
  const appsDir = join(ROOT,'apps');
  if (!isDir(appsDir)) return;
  const re = /(?:import|from|require)\s*[\s(]*['"]([^'"]+)['"]/g;
  function scanFile(fp) {
    const c = safeReadFile(fp);
    if (!c) return;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(c)) !== null) {
      if (m[1].includes('../../'))
        addViolation('DEP_002','critical',fp,'Import cruzando fronteira: "'+m[1]+'"','fragile-dep');
    }
  }
  function scanDir(dir) {
    for (const e of listDir(dir)) {
      const ep = join(dir,e);
      if (isDir(ep)) scanDir(ep);
      else if (/\.(ts|tsx|js|jsx)$/.test(e)) scanFile(ep);
    }
  }
  for (const a of listDir(appsDir)) {
    const ap = join(appsDir,a);
    if (isDir(ap) && isDir(join(ap,'src'))) scanDir(join(ap,'src'));
  }
}

function checkPackagesScope() {
  const pkgsDir = join(ROOT,'packages');
  if (!isDir(pkgsDir)) return;
  for (const e of listDir(pkgsDir)) {
    if (e === 'core-stub') continue;
    const ep = join(pkgsDir,e);
    if (!isDir(ep)) continue;
    const pkgPath = join(ep,'package.json');
    if (!isFile(pkgPath)) {
      addViolation('SCOPE_002','warning',ep,'Dir em packages/ sem package.json: '+e,'scope-mismatch');
      continue;
    }
    const pkg = safeReadJSON(pkgPath);
    if (!pkg) continue;
    if (!pkg.name || !pkg.name.startsWith('@escapekit/'))
      addViolation('SCOPE_001','warning',pkgPath,'Escopo incorreto: "'+pkg.name+'". Deve comecar com "@escapekit/"','scope-mismatch');
    const hasScript = pkg.scripts && (pkg.scripts.build || pkg.scripts.test);
    if (!pkg.name || !pkg.version || !hasScript)
      addViolation('SCOPE_002','warning',pkgPath,'Pacote sem name, version ou scripts build/test: '+e,'scope-mismatch');
  }
}

function checkDocReferences() {
  const docsDir = join(ROOT,'docs');
  if (!isDir(docsDir)) return;
  const re = /\]\((\.[./][^)]+)\)/g;
  function processDir(dir) {
    for (const e of listDir(dir)) {
      const ep = join(dir,e);
      if (isDir(ep)) { processDir(ep); continue; }
      if (!e.endsWith('.md')) continue;
      const c = safeReadFile(ep);
      if (!c) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(c)) !== null) {
        const lp = m[1];
        if (lp.startsWith('http') || lp.startsWith('#')) continue;
        if (!existsSync(resolve(dirname(ep), lp)))
          addViolation('DOCS_001','warning',ep,'Referencia morta: "'+lp+'" nao existe','dead-reference');
      }
    }
  }
  processDir(docsDir);
}

checkTopology();
checkMigrationResidues();
checkStaleArtifacts();
checkFragileDeps();
checkCrossBoundaryImports();
checkPackagesScope();
checkDocReferences();

const VERSION = '1.0.0';
const cats = [...new Set(violations.map(v => v.category))].sort();
const crit = violations.filter(v => v.severity === 'critical').length;
const warn = violations.filter(v => v.severity === 'warning').length;
const info = violations.filter(v => v.severity === 'info').length;

console.log('\nEscapeKit Conformance Checker v' + VERSION);
console.log('Raiz: ' + ROOT + '\n');

if (violations.length === 0) {
  console.log('OK Nenhuma violacao encontrada. Estrutura em conformidade.\n');
} else {
  for (const cat of cats) {
    if (cat === 'read-error') continue;
    const cv = violations.filter(v => v.category === cat);
    if (!cv.length) continue;
    console.log('-- ' + cat + ' ' + '-'.repeat(Math.max(0, 50 - cat.length)));
    for (const v of cv) {
      const lbl = v.severity === 'critical' ? '[CRITICAL]' : v.severity === 'warning' ? '[WARNING]' : '[INFO]';
      console.log('  ' + lbl + ' ' + v.rule + '  ' + v.path);
      console.log('           ' + v.message);
      console.log('');
    }
  }
  console.log('-'.repeat(56));
  console.log('  ' + violations.length + ' violacao(oes): ' + crit + ' critical, ' + warn + ' warning, ' + info + ' info');
  console.log('  Exit code: ' + (crit > 0 ? 1 : 0) + '\n');
}

process.exit(crit > 0 ? 1 : 0);
