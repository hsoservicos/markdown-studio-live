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
// F5: `1.3.0-beta.1` ou lixo na versão gerava tag `v1.3.NaN`.
if (![major, minor, patch].every(Number.isInteger)) {
  console.error(`Versão não numérica em package.json: ${pkg.version}`);
  process.exit(2);
}
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
  const heading = `## [${next}] — ${today}`;
  // Promove o acumulado para a nova versão e reabre um [Unreleased] vazio logo
  // acima. Sem reabrir, o release seguinte aborta na guarda acima — foi
  // precisamente o que aconteceu no 1.2.0 e motivou o commit manual 07e8c6c.
  const fresh = [
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '### Changed',
    '',
    '### Deprecated',
    '',
    '### Removed',
    '',
    '### Fixed',
    '',
    '### Security',
    '',
    '',
  ].join('\n');
  const updated = changelog.replace('## [Unreleased]', `${fresh}${heading}`);
  writeFileSync(changelogPath, updated, 'utf8');
}

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// F5: só o que foi de fato editado entra no stage — o `git add` do CHANGELOG
// era incondicional e quebrava o release sem o arquivo.
const staged = ['package.json'];
if (existsSync(changelogPath)) {
  staged.push('CHANGELOG.md');
}
execSync(`git add ${staged.join(' ')}`, { cwd: root, stdio: 'inherit' });
execSync(`git commit -m "chore: release v${next}"`, { cwd: root, stdio: 'inherit' });
execSync(`git tag v${next}`, { cwd: root, stdio: 'inherit' });
console.log(`Release v${next} criado (tag v${next}). Para publicar: git push origin main --tags`);
