const WORDS_PER_MINUTE = 200;

export function computeStats(content) {
  const text = String(content ?? '');
  const trimmed = text.trim();
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  const characters = text.length;
  const lines = text === '' ? 0 : text.split(/\n/).length;
  const readingMinutes = Math.max(words > 0 ? 1 : 0, Math.round(words / WORDS_PER_MINUTE));
  return { words, characters, lines, readingMinutes };
}

/**
 * Monta o texto localizado da barra de status. O texto do arquivo (quando
 * presente) aparece à frente; os números usam o idioma corrente via t().
 */
export function formatStats(stats, tFn = (k) => k, fileName) {
  const parts = [
    tFn('words').replace('{n}', String(stats.words)),
    tFn('chars').replace('{n}', String(stats.characters)),
    tFn('lines').replace('{n}', String(stats.lines)),
    tFn('readingTime').replace('{n}', String(stats.readingMinutes)),
  ];
  const base = parts.join(' · ');
  return fileName ? `${fileName} · ${base}` : base;
}

export function renderStats(container, stats, tFn = (k) => k, fileName) {
  if (!container) {
    return null;
  }
  container.textContent = formatStats(stats, tFn, fileName);
  return container;
}

// O localStorage guarda ~5 MB por origem no menor dos navegadores suportados
// (Safari/Firefox dão 5 MB; Chrome dá 10 MB), então 5 MB é o teto conservador.
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
// Aviso dispara antes de encher: gravar só falha quando já é tarde demais.
export const QUOTA_WARN_PERCENT = 90;

/**
 * Mede o uso do localStorage apenas com leituras — nunca escreve.
 * O limite do navegador é sobre chaves + valores em UTF-16 (2 bytes/caractere).
 */
export function measureStorageUsage(storage) {
  const count = storage?.length ?? 0;
  let bytes = 0;
  for (let i = 0; i < count; i++) {
    const key = storage.key(i) ?? '';
    const value = storage.getItem(key) ?? '';
    bytes += (key.length + value.length) * 2;
  }
  return { bytes, entries: count };
}

/**
 * Verificação de espaço sem efeito colateral.
 *
 * A versão anterior gravava um string de 1 MB a cada boot para descobrir se
 * cabia mais alguma coisa — um teste destrutivo que enche/esvazia o storage em
 * toda inicialização, podia deixar a chave `__quota_test__` para trás e só
 * avisava quando já era impossível salvar. Aqui o uso é medido por leitura e o
 * aviso sai cedo, quando ainda dá tempo de exportar os documentos.
 *
 * @param {{ storage?: Storage, quotaBytes?: number, warnPercent?: number }} [opts]
 * @returns {{ ok: boolean, percentUsed: number, bytes: number, quotaBytes: number }}
 *   `ok: false` = perto do limite. Uma falha de leitura (storage desabilitado,
 *   SecurityError) degrada para `ok: true`: não dá para avaliar, e a falha real
 *   aparece na própria gravação.
 */
export function checkStorageQuota({
  storage,
  quotaBytes = STORAGE_QUOTA_BYTES,
  warnPercent = QUOTA_WARN_PERCENT,
} = {}) {
  try {
    const target = storage ?? globalThis.localStorage;
    const { bytes } = measureStorageUsage(target);
    const percentUsed = Math.min(100, Math.round((bytes / quotaBytes) * 100));
    return { ok: percentUsed < warnPercent, percentUsed, bytes, quotaBytes };
  } catch {
    return { ok: true, percentUsed: 0, bytes: 0, quotaBytes };
  }
}

export function setupStatusBar({
  container = document,
  getContent = () => '',
  tFn,
  getFileName = () => null,
} = {}) {
  const el = container.querySelector('#status-stats');
  if (!el) {
    return null;
  }
  const update = () => renderStats(el, computeStats(getContent()), tFn, getFileName());
  return {
    update,
    render: () => update(),
    checkQuota: checkStorageQuota,
  };
}
