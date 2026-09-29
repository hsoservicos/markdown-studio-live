import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A CSP vive no `nginx.conf` (produção/Docker), mas o script que ela autoriza por
 * hash vive no `index.html`. Se os dois saírem de sincronia, o app quebra só em
 * produção — por isso a correspondência é travada aqui.
 */
const root = process.cwd();
const nginxConf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');

function getCsp() {
  const match = nginxConf.match(/Content-Security-Policy "([^"]+)"/);
  expect(match, 'CSP ausente no nginx.conf').toBeTruthy();
  return match[1];
}

// Tokens sem as aspas simples do CSP ('self' → self, 'sha256-x' → sha256-x).
function getDirective(csp, name) {
  const directive = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  expect(directive, `diretiva ${name} ausente`).toBeTruthy();
  return directive.split(/\s+/).map((t) => t.replace(/^'|'$/g, ''));
}

function inlineScriptHashes() {
  const hashes = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(indexHtml)) !== null) {
    hashes.push(`sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}`);
  }
  return hashes;
}

describe('CSP (nginx.conf)', () => {
  it('tem script-src sem unsafe-inline e sem unsafe-eval', () => {
    const scriptSrc = getDirective(getCsp(), 'script-src');
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(scriptSrc).toContain('self');
  });

  it('autoriza por hash exatamente o(s) script(s) inline do index.html', () => {
    const scriptSrc = getDirective(getCsp(), 'script-src');
    const hashes = inlineScriptHashes();
    expect(hashes.length, 'esperado ao menos um script inline (boot de tema)').toBeGreaterThan(0);
    hashes.forEach((hash) => {
      expect(scriptSrc, `hash ${hash} não está na CSP`).toContain(hash);
    });
    // e nada de hashes órfãos na CSP
    const cspHashes = scriptSrc.filter((t) => t.startsWith('sha256-'));
    expect(cspHashes).toHaveLength(hashes.length);
  });

  it('mantém style-src unsafe-inline (exigido por Monaco/KaTeX/Mermaid)', () => {
    const styleSrc = getDirective(getCsp(), 'style-src');
    expect(styleSrc).toContain('unsafe-inline');
    expect(styleSrc).toContain('self');
  });

  it('endurece as demais diretivas', () => {
    const csp = getCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('mantém img-src com data:/blob: para o preview e as exportações', () => {
    const imgSrc = getDirective(getCsp(), 'img-src');
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
  });
});
