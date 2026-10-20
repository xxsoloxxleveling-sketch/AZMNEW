// Compare the real application sources to current main without copying or editing it.
const ts = require('../../node_modules/typescript');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const tracked = git('ls-tree', '-r', '--name-only', 'origin/main', 'src', 'backend/src', 'App.tsx', 'index.tsx', 'types.ts').split('\n').filter(f => /\.tsx?$/.test(f));
const changed = git('diff', '--name-only').split('\n').filter(f => tracked.includes(f));
const originals = new Map(changed.map(f => [path.join(root, f).replace(/\\/g, '/').toLowerCase(), git('show', 'origin/main:' + f)]));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const run = baseline => {
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host);
  if (baseline) host.readFile = name => originals.get(name.replace(/\\/g, '/').toLowerCase()) ?? read(name);
  const files = baseline ? tracked : [...tracked, 'backend/src/modules/students/hsscContract.ts', 'src/components/admin/students/StudyGroupCorrectionDialog.tsx'];
  const program = ts.createProgram(files.map(f => path.join(root, f)), options, host);
  return ts.getPreEmitDiagnostics(program).map(d => `${d.file ? path.relative(root, d.file.fileName).replace(/\\/g, '/') : ''}:TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).sort();
};
const baseline = run(true), current = run(false), added = current.filter(d => !baseline.includes(d));
fs.mkdirSync(path.join(root, 'tmp/hssc-flow-20261020'), { recursive: true });
fs.writeFileSync(path.join(root, 'tmp/hssc-flow-20261020/typecheck.json'), JSON.stringify({ baseline, current, added }, null, 2));
console.log(JSON.stringify({ baseline: baseline.length, current: current.length, added }, null, 2));
if (added.length) process.exitCode = 1;
