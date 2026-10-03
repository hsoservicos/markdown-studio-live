export function svgToDataUrl(svgString) {
  if (!svgString || typeof svgString !== 'string') {
    return null;
  }
  const cleaned = svgString.trim();
  if (!cleaned.startsWith('<svg')) {
    return null;
  }
  const encoded = encodeURIComponent(cleaned).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

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
