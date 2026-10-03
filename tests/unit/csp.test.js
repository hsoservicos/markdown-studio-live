import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { KEYS } from '../../src/i18n/index.js';

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

  // O Cloudflare injeta o JavaScript Detections como <script> inline com hash dinâmico
  // por request: não há hash estável que autorizar no script-src, então sem esta linha a
  // CSP estrita gera erro de console em toda visita. A doc do Cloudflare determina que
  // `Cache-Control: no-transform` na resposta da origin suspende a injeção.
  it('declara no-transform para o Cloudflare não injetar o JavaScript Detections', () => {
    const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    expect(conf).toMatch(/add_header\s+Cache-Control\s+"[^"]*no-transform[^"]*"\s+always/);
  });

  // O nginx cancela a herança de TODOS os `add_header` do nível server assim que um
  // location declara qualquer `add_header`. Por isso o bloco de segurança — e a CSP
  // junto com ele — é repetido em `location /`. Se alguém editar só uma das cópias,
  // o app quebra só no shell da SPA: este teste é o detector.
  it('as cópias da CSP no nginx.conf são idênticas', () => {
    const csps = [...nginxConf.matchAll(/Content-Security-Policy "([^"]+)"/g)].map((m) => m[1]);
    expect(csps.length, 'esperadas 2 cópias (server + location /)').toBe(2);
    expect(csps[1], 'cópias da CSP divergem entre server e location /').toBe(csps[0]);
  });

  // Shell do app nunca cacheado: sem no-store o browser usa cache heurístico baseado
  // em Last-Modified e mantém HTML de um deploy anterior, apontando para assets
  // hasheados que já não existem (página em branco em produção).
  it('location / entrega no-store junto do no-transform', () => {
    const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    const locationBlock = conf.match(/location \/ \{([\s\S]*?)^\s*\}/m);
    expect(locationBlock, 'location / ausente no nginx.conf').toBeTruthy();
    expect(locationBlock[1]).toMatch(/Cache-Control\s+"[^"]*no-store[^"]*"\s+always/);
    expect(locationBlock[1]).toMatch(/Cache-Control\s+"[^"]*no-transform[^"]*"\s+always/);
  });

  // Herança dos assets: se um `add_header` entrar em /assets/, /css/ ou na regex
  // de imagens, os arquivos perdem CSP/nosniff/HSTS em produção (F5).
  it('locations de asset, css e imagem não declaram add_header', () => {
    const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    const expected = ['location /assets/ {', 'location /css/ {', 'location ~* \\.(ttf'];
    const bodies = expected.map((marker) => {
      const start = conf.indexOf(marker);
      expect(start, `marker não encontrado: ${marker}`).toBeGreaterThanOrEqual(0);
      const end = conf.indexOf('\n    }', start);
      return conf.slice(start, end);
    });
    for (const body of bodies) {
      expect(body, 'add_header em location de asset cancela a herança de segurança').not.toMatch(
        /\badd_header\b/,
      );
      expect(body).toMatch(/\bexpires\b/);
    }
  });

  // F1: o CSS do app não pode cair no no-store do `location /` — era rebaixado
  // a cada load (e os `?v=` cache-busters não ajudavam).
  it('location /css/ usa expires e não herda o no-store do shell', () => {
    const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    const start = conf.indexOf('location /css/ {');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = conf.slice(start, conf.indexOf('\n    }', start));
    expect(body).toMatch(/expires\s+30d/);
    expect(body).not.toMatch(/no-store/);
  });

  // F2: headers de endurecimento presentes nas DUAS cópias do bloco de
  // segurança (server + location /) — mesma regra de herança da CSP.
  it('Permissions-Policy/COOP/CORP existem nas duas cópias do bloco de segurança', () => {
    const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    for (const header of [
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
    ]) {
      const copies = [
        ...conf.matchAll(new RegExp(`add_header\\s+${header}\\s+"([^"]+)"`, 'g')),
      ].map((m) => m[1]);
      expect(copies, `${header}: esperadas 2 cópias (server + location /)`).toHaveLength(2);
      expect(copies[1], `${header}: cópias divergem`).toBe(copies[0]);
    }
  });
});

describe('H5 — contrato do anti-FOUC (index.html ↔ app)', () => {
  const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');

  it('BOOT_THEME_KEY do index.html é a mesma chave que o app grava', () => {
    const key = indexHtml.match(/BOOT_THEME_KEY\s*=\s*'([^']+)'/)?.[1];
    expect(key).toBeTruthy();
    expect(key).toBe(KEYS.themeBoot);
  });

  it('variantes PREVIEW_CSS batem com o mapeamento do setPreviewCss (light/dark_dimmed)', () => {
    const light = indexHtml.match(/PREVIEW_CSS_LIGHT\s*=\s*'([^']+)'/)?.[1];
    const dark = indexHtml.match(/PREVIEW_CSS_DARK\s*=\s*'([^']+)'/)?.[1];
    // mesmos caminhos que src/main.js monta em setPreviewCss
    expect(light).toBe('css/github-markdown-light.css?v=1.0.0');
    expect(dark).toBe('css/github-markdown-dark_dimmed.css?v=1.0.0');
    // os arquivos existem de verdade no public/
    for (const href of [light, dark]) {
      const file = href.split('?')[0].replace(/^css\//, 'public/css/');
      expect(existsSync(resolve(root, file)), `${href} sem arquivo em public/`).toBe(true);
    }
  });
});
