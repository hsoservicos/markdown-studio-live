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

export function svgToPngDataUrl(svgString, scale = 2) {
  if (typeof document === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}
