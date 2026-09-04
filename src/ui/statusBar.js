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

export function checkStorageQuota() {
  try {
    const testKey = '__quota_test__';
    const bigString = 'x'.repeat(1024 * 1024);
    localStorage.setItem(testKey, bigString);
    localStorage.removeItem(testKey);
    return { ok: true, percentUsed: 0 };
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += (localStorage.getItem(key) || '').length;
      }
      return { ok: false, percentUsed: Math.round((total / (5 * 1024 * 1024)) * 100) };
    }
    return { ok: true, percentUsed: 0 };
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
