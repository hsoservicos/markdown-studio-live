import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, 'package.json');
const changelogPath = join(root, 'CHANGELOG.md');

const bump = process.argv[2] || 'patch';
const valid = ['major', 'minor', 'patch'];
if (!valid.includes(bump)) {
  console.error(`Uso: npm run release[:major|:minor] (padrão patch). Recebido: ${bump}`);
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next =
  bump === 'major'
    ? `${major + 1}.0.0`
    : bump === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, 'utf8');
  if (!changelog.includes('## [Unreleased]')) {
    console.error('CHANGELOG.md não contém seção ## [Unreleased]. Aborte o release.');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const updated = changelog.replace('## [Unreleased]', `## [${next}] — ${today}`);
  writeFileSync(changelogPath, updated, 'utf8');
}

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

execSync(`git add package.json CHANGELOG.md`, { cwd: root, stdio: 'inherit' });
execSync(`git commit -m "chore: release v${next}"`, { cwd: root, stdio: 'inherit' });
execSync(`git tag v${next}`, { cwd: root, stdio: 'inherit' });
console.log(`Release v${next} criado (tag v${next}). Para publicar: git push origin main --tags`);
