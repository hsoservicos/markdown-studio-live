/**
 * Sync de rolagem unidirecional (editor → preview) por proporção.
 */
export function computePreviewTargetY(scrollTop, scrollHeight, height, previewElement) {
  const maxScrollTop = scrollHeight - height;
  if (maxScrollTop <= 0) {
    return 0;
  }
  const ratio = scrollTop / maxScrollTop;
  return (previewElement.scrollHeight - previewElement.clientHeight) * ratio;
}

export function scrollPreviewTo(editorEvent, editor, previewElement) {
  const scrollTop = editorEvent.scrollTop;
  const scrollHeight = editorEvent.scrollHeight;
  const height = editor.getLayoutInfo().height;
  const targetY = computePreviewTargetY(scrollTop, scrollHeight, height, previewElement);
  previewElement.scrollTo(0, targetY);
}
