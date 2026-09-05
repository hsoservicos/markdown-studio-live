/**
 * Component Library — Markdown-Studio
 *
 * Componentes reutilizáveis extraídos do design system "The Quiet Studio".
 * Cada componente segue os tokens definidos em tokens.js.
 */

// ============================================
// Button Component
// ============================================

export const buttonStyles = {
  base: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 var(--space-md, 16px);
    border: none;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.9375rem;
    font-weight: 500;
    font-family: var(--font-ui);
    cursor: pointer;
    transition: all var(--ease-state, 150ms ease);
  `,
  ghost: `
    background-color: transparent;
    color: var(--color-text);
  `,
  primary: `
    background-color: var(--color-primary, #0f766e);
    color: #ffffff;
  `,
  secondary: `
    background-color: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  `,
  hover: `
    transform: translateY(-1px);
  `,
  active: `
    transform: translateY(0);
  `,
  focus: `
    outline: 2px solid var(--color-accent, #0f766e);
    outline-offset: 2px;
  `,
};

// ============================================
// Input Component
// ============================================

export const inputStyles = {
  base: `
    width: 100%;
    height: 40px;
    padding: 0 var(--space-sm, 12px);
    border: 1px solid var(--color-border, #d0d7de);
    border-radius: var(--radius-sm, 6px);
    background-color: var(--color-surface, #ffffff);
    color: var(--color-text);
    font-size: 0.9375rem;
    font-family: var(--font-ui);
    transition: border-color var(--ease-state), box-shadow var(--ease-state);
  `,
  hover: `
    border-color: var(--color-border-strong, #afb8c1);
  `,
  focus: `
    outline: none;
    border-color: var(--color-primary, #0f766e);
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
  `,
  placeholder: `
    color: var(--color-text-muted, #57606a);
    opacity: 0.7;
  `,
};

// ============================================
// Select Component
// ============================================

export const selectStyles = {
  base: `
    width: 100%;
    height: 40px;
    padding: 0 var(--space-sm, 12px);
    padding-right: 36px;
    border: 1px solid var(--color-border, #d0d7de);
    border-radius: var(--radius-sm, 6px);
    background-color: var(--color-surface, #ffffff);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    color: var(--color-text);
    font-size: 0.9375rem;
    font-family: var(--font-ui);
    appearance: none;
    cursor: pointer;
    transition: border-color var(--ease-state), box-shadow var(--ease-state);
  `,
};

// ============================================
// Dialog Component
// ============================================

export const dialogStyles = {
  base: `
    max-width: 480px;
    width: min(480px, calc(100% - 32px));
    padding: 0;
    border: 1px solid var(--color-border, #d0d7de);
    border-radius: var(--radius-md, 8px);
    background-color: var(--color-surface, #ffffff);
    color: var(--color-text);
    box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.15);
  `,
  backdrop: `
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  `,
  header: `
    display: flex;
    align-items: center;
    gap: var(--space-sm, 12px);
    padding: var(--space-md, 16px) var(--space-md, 16px) var(--space-sm, 8px);
    border-bottom: 1px solid var(--color-border, #d0d7de);
  `,
  title: `
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-strong);
    flex: 1;
  `,
  close: `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
    transition: background-color var(--ease-state), color var(--ease-state);
  `,
};

// ============================================
// Animation Tokens
// ============================================

export const animations = {
  'dialog-fade-in': `
    @keyframes dialogFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  'backdrop-fade-in': `
    @keyframes backdropFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  'dialog-animation': `
    animation: dialogFadeIn 0.2s ease-out;
  `,
  'backdrop-animation': `
    animation: backdropFadeIn 0.2s ease-out;
  `,
};
