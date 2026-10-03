/**
 * Coleta os SVGs dos diagramas mermaid já renderizados no preview.
 * O pdfmake recebe a STRING do SVG no content type `svg` (A2: `image` só
 * decodifica JPEG/PNG — data-URL de SVG abortava o export).
 */
export function captureMermaidSvgs(root) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return new Map();
  }
  const svgMap = new Map();
  const elements = root.querySelectorAll('.mermaid');
  for (const el of elements) {
    const svg = el.querySelector('svg');
    if (svg) {
      const source = el.dataset.mermaidSource || '';
      svgMap.set(source, svg.outerHTML);
    }
  }
  return svgMap;
}
