/**
 * Painéis redimensionáveis via divisor arrastável.
 * Suporta orientação vertical (desktop, col-resize) e
 * horizontal (mobile empilhado, row-resize).
 *
 * B1: acessível por teclado — setas ajustam em passos de 2%, Home/End vão aos
 * limites; `aria-valuenow` (0–100) e `aria-orientation` acompanham o estado.
 */

const KEYBOARD_STEP = 0.02;

export function setupDivider() {
  let lastLeftRatio = 0.5;
  let lastTopRatio = 0.5;
  const divider = document.getElementById('split-divider');
  const leftPane = document.getElementById('edit');
  const rightPane = document.getElementById('preview');
  const container = document.getElementById('container');

  if (!divider || !leftPane || !rightPane || !container) {
    return;
  }

  let isDragging = false;
  let pointerId = null;

  const isStacked = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

  const syncAriaOrientation = () => {
    divider.setAttribute('aria-orientation', isStacked() ? 'horizontal' : 'vertical');
  };

  const clampAxis = (offsetMax, offset) => {
    const minSize = 100;
    const maxSize = Math.max(offsetMax - minSize, minSize);
    return Math.max(minSize, Math.min(offset, maxSize));
  };

  const applySizes = (offset, axisMax, dividerSize, isRatio) => {
    if (isStacked()) {
      const topHeight = clampAxis(axisMax, offset);
      leftPane.style.height = `${topHeight}px`;
      rightPane.style.height = `${axisMax - topHeight - dividerSize}px`;
      if (isRatio) {
        lastTopRatio = topHeight / Math.max(axisMax - dividerSize, 1);
      }
      divider.setAttribute(
        'aria-valuenow',
        String(Math.round((topHeight / Math.max(axisMax - dividerSize, 1)) * 100)),
      );
    } else {
      const leftWidth = clampAxis(axisMax, offset);
      leftPane.style.width = `${leftWidth}px`;
      rightPane.style.width = `${axisMax - leftWidth - dividerSize}px`;
      if (isRatio) {
        lastLeftRatio = leftWidth / Math.max(axisMax - dividerSize, 1);
      }
      divider.setAttribute(
        'aria-valuenow',
        String(Math.round((leftWidth / Math.max(axisMax - dividerSize, 1)) * 100)),
      );
    }
  };

  divider.addEventListener('pointerdown', (e) => {
    isDragging = true;
    pointerId = e.pointerId;
    divider.classList.add('active');
    divider.setPointerCapture(pointerId);
    document.body.style.cursor = isStacked() ? 'row-resize' : 'col-resize';
  });

  divider.addEventListener('pointermove', (e) => {
    if (!isDragging) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const axisMax = containerRect.width;
    const axisExtent = containerRect.height;
    const offsetX = e.clientX - containerRect.left;
    const offsetY = e.clientY - containerRect.top;
    const dividerSize = divider.offsetWidth;
    if (isStacked()) {
      applySizes(offsetY, axisExtent, divider.offsetHeight, true);
    } else {
      applySizes(offsetX, axisMax, dividerSize, true);
    }
  });

  divider.addEventListener('pointerup', () => {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    divider.classList.remove('active');
    document.body.style.cursor = 'default';
    if (pointerId != null) {
      divider.releasePointerCapture(pointerId);
      pointerId = null;
    }
  });

  divider.addEventListener('dblclick', () => {
    const containerRect = container.getBoundingClientRect();
    if (isStacked()) {
      const halfHeight = (containerRect.height - divider.offsetHeight) / 2;
      applySizes(halfHeight, containerRect.height, divider.offsetHeight, true);
    } else {
      const halfWidth = (containerRect.width - divider.offsetWidth) / 2;
      applySizes(halfWidth, containerRect.width, divider.offsetWidth, true);
    }
  });

  divider.addEventListener('keydown', (e) => {
    const keyActions = {
      ArrowLeft: -KEYBOARD_STEP,
      ArrowUp: -KEYBOARD_STEP,
      ArrowRight: KEYBOARD_STEP,
      ArrowDown: KEYBOARD_STEP,
      Home: -1,
      End: 1,
    };
    if (!(e.key in keyActions)) {
      return;
    }
    e.preventDefault();
    const containerRect = container.getBoundingClientRect();
    const clampRatio = (value) => Math.max(0, Math.min(1, value));
    if (isStacked()) {
      const available = containerRect.height - divider.offsetHeight;
      const next = clampRatio(lastTopRatio + keyActions[e.key]);
      applySizes(available * next, containerRect.height, divider.offsetHeight, true);
    } else {
      const available = containerRect.width - divider.offsetWidth;
      const next = clampRatio(lastLeftRatio + keyActions[e.key]);
      applySizes(available * next, containerRect.width, divider.offsetWidth, true);
    }
  });

  window.addEventListener('resize', () => {
    const containerRect = container.getBoundingClientRect();
    syncAriaOrientation();
    if (isStacked()) {
      const availableHeight = containerRect.height - divider.offsetHeight;
      applySizes(availableHeight * lastTopRatio, containerRect.height, divider.offsetHeight, false);
    } else {
      const availableWidth = containerRect.width - divider.offsetWidth;
      applySizes(availableWidth * lastLeftRatio, containerRect.width, divider.offsetWidth, false);
    }
  });

  syncAriaOrientation();
}
