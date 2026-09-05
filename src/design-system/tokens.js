/**
 * Design Tokens — Markdown-Studio
 *
 * Tokens consolidados do design system "The Quiet Studio".
 * Estes tokens são a fonte de verdade para cores, espaçamento,
 * tipografia, border-radius e transições.
 *
 * Uso: importe os tokens necessários e aplique via CSS custom properties
 * ou diretamente no código JavaScript.
 */

// ============================================
// Colors
// ============================================

export const colors = {
  // Primary
  primary: '#0f766e',
  'primary-strong': '#115e59',
  'primary-focus': '#0f766e',
  'primary-on-dark': '#2dd4bf',

  // Neutral (Light)
  bg: '#fafafa',
  surface: '#ffffff',
  'surface-tint': '#f6f8fa',
  border: '#d0d7de',
  'border-strong': '#afb8c1',

  // Text (Light)
  text: '#24292f',
  'text-strong': '#1f2328',
  'text-muted': '#57606a',
  'text-faint': '#afb8c1',

  // Dark theme
  'dark-bg': '#161b22',
  'dark-surface': '#0d1117',
  'dark-surface-tint': '#1c2129',
  'dark-border': '#30363d',
  'dark-border-strong': '#484f58',
  'dark-text': '#e6edf3',
  'dark-text-strong': '#f0f6fc',
  'dark-text-muted': '#8b949e',
  'dark-text-faint': '#6e7681',

  // Semantic
  error: '#cf222e',
  'error-dark': '#ff7b72',
  success: '#1a7f37',
};

// ============================================
// Typography
// ============================================

export const typography = {
  'font-ui':
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans", sans-serif',
  'font-mono': 'ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Consolas, monospace',

  // Hierarchy
  'display-size': '1.5rem',
  'display-weight': 600,
  'display-leading': 1.2,
  'display-tracking': '-0.02em',

  'title-size': '1rem',
  'title-weight': 600,
  'title-leading': 1.4,
  'title-tracking': '-0.01em',

  'body-size': '0.875rem',
  'body-weight': 400,
  'body-leading': 1.5,

  'label-size': '0.8125rem',
  'label-weight': 500,
  'label-leading': 1.3,
  'label-tracking': '0.01em',

  'mono-size': '0.8125rem',
  'mono-weight': 400,
  'mono-leading': 1.5,
};

// ============================================
// Spacing
// ============================================

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

// ============================================
// Border Radius
// ============================================

export const radius = {
  sm: '6px',
  md: '8px',
  pill: '999px',
};

// ============================================
// Transitions
// ============================================

export const transitions = {
  ease: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  'ease-in': '150ms cubic-bezier(0.4, 0, 1, 1)',
  'ease-out': '150ms cubic-bezier(0, 0, 0.2, 1)',
  'ease-in-out': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  fast: '100ms ease',
  normal: '150ms ease',
  slow: '250ms ease',
};

// ============================================
// Component Tokens
// ============================================

export const components = {
  // Button variants
  'button-ghost-bg': 'transparent',
  'button-ghost-text': '{colors.text}',
  'button-ghost-hover-bg': '{colors.surface-tint}',
  'button-ghost-hover-text': '{colors.text-strong}',
  'button-ghost-active-bg': '{colors.border}',

  'button-primary-bg': '{colors.primary}',
  'button-primary-text': '#ffffff',
  'button-primary-hover-bg': '{colors.primary-strong}',
  'button-primary-active-bg': '{colors.primary-strong}',

  // Input
  'input-bg': '{colors.surface}',
  'input-border': '{colors.border}',
  'input-border-hover': '{colors.border-strong}',
  'input-border-focus': '{colors.primary}',
  'input-radius': '{radius.sm}',
  'input-height': '40px',

  // Dialog
  'dialog-bg': '{colors.surface}',
  'dialog-border': '{colors.border}',
  'dialog-radius': '{radius.md}',
  'dialog-shadow': '0 20px 60px -15px rgba(0, 0, 0, 0.15)',
  'dialog-backdrop': 'rgba(0, 0, 0, 0.4)',
  'dialog-backdrop-blur': 'blur(4px)',
};

// ============================================
// CSS Custom Properties Generator
// ============================================

export function generateCSSVariables(theme = 'light') {
  const isDark = theme === 'dark';

  return {
    '--color-accent': isDark ? colors['primary-on-dark'] : colors.primary,
    '--color-accent-strong': isDark ? '#5ddfce' : colors['primary-strong'],
    '--color-accent-focus': isDark ? colors['primary-on-dark'] : colors['primary-focus'],
    '--color-bg': isDark ? colors['dark-bg'] : colors.bg,
    '--color-surface': isDark ? colors['dark-surface'] : colors.surface,
    '--color-surface-tint': isDark ? colors['dark-surface-tint'] : colors['surface-tint'],
    '--color-border': isDark ? colors['dark-border'] : colors.border,
    '--color-border-strong': isDark ? colors['dark-border-strong'] : colors['border-strong'],
    '--color-text': isDark ? colors['dark-text'] : colors.text,
    '--color-text-strong': isDark ? colors['dark-text-strong'] : colors['text-strong'],
    '--color-text-muted': isDark ? colors['dark-text-muted'] : colors['text-muted'],
    '--color-text-faint': isDark ? colors['dark-text-faint'] : colors['text-faint'],
    '--color-error': isDark ? colors['error-dark'] : colors.error,
    '--font-ui': typography['font-ui'],
    '--font-mono': typography['font-mono'],
    '--radius-sm': radius.sm,
    '--radius-md': radius.md,
    '--space-xxs': spacing.xxs,
    '--space-xs': spacing.xs,
    '--space-sm': spacing.sm,
    '--space-md': spacing.md,
    '--space-lg': spacing.lg,
    '--space-xl': spacing.xl,
    '--ease-state': transitions.ease,
  };
}
