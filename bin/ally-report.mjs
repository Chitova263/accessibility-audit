#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');
const script = resolve(__dirname, '../src/generate-report.ts');

const child = spawn(tsx, [script, ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
