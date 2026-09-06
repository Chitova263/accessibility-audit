#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');

const subcommand = process.argv[2];

const scripts = {
    audit: resolve(__dirname, '../src/cli/audit-command.ts'),
    report: resolve(__dirname, '../src/cli/report-command.ts'),
};

if (!subcommand || !scripts[subcommand]) {
    console.error(`Usage: ally <command> [options]

Commands:
  audit   Drive a screen reader through a page and collect violations
  report  Generate an HTML report from audit results
`);
    process.exit(subcommand ? 1 : 0);
}

const child = spawn(tsx, [scripts[subcommand], ...process.argv.slice(3)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
