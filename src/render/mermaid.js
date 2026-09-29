import { t } from '../i18n/index.js';

let renderTimer = null;
let renderVersion = 0;
let renderInFlight = null;
let schedulingEnabled = true;

// Lazy: mermaid vale ~5 MB (1,4 MB gzip) e só é necessário quando o documento
// tem bloco ```mermaid. Import estático aqui puxava tudo para o boot do app.
let mermaidModule = null;
let mermaidLoading = null;

function loadMermaid() {
  if (mermaidModule) {
    return Promise.resolve(mermaidModule);
  }
  if (!mermaidLoading) {
    mermaidLoading = import('mermaid').then((mod) => {
      mermaidModule = mod.default;
      return mermaidModule;
    });
  }
  return mermaidLoading;
}

export async function configureMermaid(theme = 'default') {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
  });
}

export function getDefaultTheme() {
  return 'default';
}

export function showMermaidError(element, error) {
  const message = error && error.message ? error.message : t('mermaidRenderFailed');
  element.classList.add('mermaid-error');
  element.textContent = `${t('mermaidError')}${message}`;
}

export function getMermaidTheme() {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
  ) {
    return 'dark';
  }
  return 'default';
}

// `async` aqui não é cosmético: `theme = getMermaidTheme()` é um default
// parameter, e numa função não-async uma exceção nele lança de forma síncrona —
// antes de existir promise para quem chamou encadear um `.catch`.
export async function renderMermaidDiagramsIn(rootElement, theme = getMermaidTheme()) {
  if (!rootElement) {
    return;
  }

  // Single-flight: mermaid.render não é reentrante. O lock é adquirido de forma
  // SÍNCRONA, antes de qualquer await: como o mermaid virou lazy-load, setar
  // renderInFlight depois do load abriria uma janela em que dois chamadores
  // concorrentes passariam pela checagem ao mesmo tempo.
  if (renderInFlight) {
    return renderInFlight.catch(() => {}).then(() => renderMermaidDiagramsIn(rootElement, theme));
  }

  const version = ++renderVersion;

  const current = (async () => {
    await configureMermaid(theme);
    const mermaid = await loadMermaid();

    const elements = Array.from(rootElement.querySelectorAll('.mermaid'));
    for (const [index, element] of elements.entries()) {
      if (version !== renderVersion) {
        return;
      }

      const source = element.dataset.mermaidSource || element.textContent;
      element.dataset.mermaidSource = source;
      element.classList.remove('mermaid-error');

      try {
        const renderId = `mermaid-${Date.now()}-${version}-${index}`;
        const { svg, bindFunctions } = await mermaid.render(renderId, source);
        if (version !== renderVersion) {
          return;
        }
        element.innerHTML = svg;
        if (typeof bindFunctions === 'function') {
          bindFunctions(element);
        }
      } catch (error) {
        showMermaidError(element, error);
      }
    }
  })();

  renderInFlight = current;
  return current.finally(() => {
    if (renderInFlight === current) {
      renderInFlight = null;
    }
  });
}

export async function renderMermaidDiagramsNow(theme = getMermaidTheme()) {
  const outputElement = typeof document !== 'undefined' ? document.querySelector('#output') : null;
  return renderMermaidDiagramsIn(outputElement, theme);
}

export function scheduleMermaidRender(delay = 150) {
  if (!schedulingEnabled) {
    return;
  }
  if (renderTimer) {
    clearTimeout(renderTimer);
  }
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderMermaidDiagramsNow();
  }, delay);
}

export function pauseMermaidScheduling() {
  schedulingEnabled = false;
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
}

export function resumeMermaidScheduling() {
  schedulingEnabled = true;
}

export function renderMermaidDiagrams(theme) {
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  return renderMermaidDiagramsNow(theme);
}
