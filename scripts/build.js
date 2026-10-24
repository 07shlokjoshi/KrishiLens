#!/usr/bin/env node
/**
 * KrishiLens Build Script
 * Validates project structure, dependencies, and frontend assets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const REQUIRED_DIRS = [
  'public',
  'public/css',
  'public/js',
  'src/services',
  'src/routes',
  'data/pesticide_pilot_dataset',
  'experiments/detection/weights',
  'scripts',
];

const REQUIRED_FILES = [
  'server.js',
  'package.json',
  'public/index.html',
  'public/css/style.css',
  'public/js/app.js',
  'src/services/yoloServer.py',
  'src/routes/yolo.js',
  'data/pesticide_pilot_dataset/data.yaml',
];

let errors = [];
let warnings = [];

console.log('🔨 KrishiLens Build Validation\n');

// Check required directories
console.log('📂 Checking directories...');
REQUIRED_DIRS.forEach(dir => {
  const fullPath = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing directory: ${dir}`);
  }
});
if (errors.length === 0) {
  console.log('   ✅ All required directories present\n');
}

// Check required files
console.log('📄 Checking files...');
REQUIRED_FILES.forEach(file => {
  const fullPath = path.join(PROJECT_ROOT, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing file: ${file}`);
  }
});
if (REQUIRED_FILES.every(f => fs.existsSync(path.join(PROJECT_ROOT, f)))) {
  console.log('   ✅ All required files present\n');
}

// Check frontend assets
console.log('🎨 Checking frontend assets...');
const indexPath = path.join(PROJECT_ROOT, 'public/index.html');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf-8');
  if (content.includes('app.js') && content.includes('style.css')) {
    console.log('   ✅ Frontend assets linked correctly\n');
  } else {
    warnings.push('Frontend assets may not be properly linked in index.html');
  }
}

// Check dataset validation script
console.log('✔️  Checking dataset tools...');
const validatePath = path.join(PROJECT_ROOT, 'scripts/validate_dataset.py');
if (fs.existsSync(validatePath)) {
  console.log('   ✅ Dataset validation script present\n');
} else {
  warnings.push('Dataset validation script not found');
}

// Check Python YOLO dependencies (optional)
console.log('🐍 Checking Python environment...');
const venvPath = path.join(PROJECT_ROOT, '.venv');
if (fs.existsSync(venvPath)) {
  console.log('   ✅ Python virtual environment present\n');
} else {
  warnings.push('Python virtual environment not found - run: python -m venv .venv');
}

// Check Node dependencies
console.log('📦 Checking Node dependencies...');
const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ Node modules installed\n');
} else {
  warnings.push('Node modules not installed - run: npm install');
}

// Validate server.js syntax
console.log('🔍 Validating server.js...');
const { execSync } = await import('child_process');
try {
  execSync('node -c server.js', { cwd: PROJECT_ROOT, stdio: 'pipe' });
  console.log('   ✅ Server syntax valid\n');
} catch (e) {
  errors.push('server.js has syntax errors');
}

// Summary
console.log('═══════════════════════════════════════════════════════');
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ BUILD VALIDATION PASSED\n');
  console.log('Ready to run: npm start');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
  }

  if (errors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
