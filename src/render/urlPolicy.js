/**
 * Política de URLs compartilhada por todas as fronteiras que emitem conteúdo
 * derivado do markdown do usuário.
 *
 * O preview (`src/render/convert.js`) usa a regex como `ALLOWED_URI_REGEXP` do
 * DOMPurify; o PDF vetorial (`src/pdf/markdown-to-pdfmake.js`) usa os helpers
 * para decidir se um link vira anotação e se uma imagem é embutível. Antes desta
 * extração o PDF vetorial confiava cegamente no `href` do token do `marked`,
 * permitindo `javascript:` em anotações de link.
 */

/**
 * Somente `http(s)`, `mailto:` e URLs relativas. Bloqueia schemes ativos
 * (`javascript:`, `vbscript:`, `tel:`, `callto:`, `data:` em links…).
 *
 * Mantida idêntica à regex histórica do DOMPurify — é um contrato coberto por
 * `tests/unit/convert.test.js`.
 */
export const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/**
 * Imagens aceitam o mesmo perfil de links, mais `data:image/<tipo>` (caminho
 * usado pelo mermaid/KaTeX/SVG embutidos). `data:text/html` e schemes ativos
 * continuam bloqueados.
 */
export const ALLOWED_IMAGE_URI_REGEXP =
  /^(?:data:image\/(?:png|jpe?g|gif|webp|bmp|avif|svg\+xml)[;,][\s\S]*|https?:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/** `true` quando o href pode virar link clicável. */
export function isSafeLinkHref(href) {
  return typeof href === 'string' && href.trim() !== '' && ALLOWED_URI_REGEXP.test(href.trim());
}

/** `true` quando a origem pode ser embutida como imagem. */
export function isSafeImageSrc(src) {
  return typeof src === 'string' && src.trim() !== '' && ALLOWED_IMAGE_URI_REGEXP.test(src.trim());
}
