import mermaid from 'mermaid';
import { t } from '../i18n/index.js';

let renderTimer = null;
let renderVersion = 0;
let renderInFlight = null;
let schedulingEnabled = true;

export function configureMermaid(theme = 'default') {
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

export async function renderMermaidDiagramsIn(rootElement, theme = getMermaidTheme()) {
  if (!rootElement) {
    return;
  }

  // Single-flight: mermaid.render não é reentrante. Se houver uma passagem em
  // andamento, aguarda-a concluir antes de iniciar a próxima. O version-guard
  // continua impedindo que SVG obsoleto seja escrito no DOM.
  if (renderInFlight) {
    await renderInFlight.catch(() => {});
  }

  const version = ++renderVersion;
  configureMermaid(theme);

  const current = (async () => {
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
  try {
    await current;
  } finally {
    if (renderInFlight === current) {
      renderInFlight = null;
    }
  }
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
