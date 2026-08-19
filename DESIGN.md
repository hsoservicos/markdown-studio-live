---
name: Markdown-Studio
description: Editor Markdown com preview em tempo real — moderno, profissional e minimalista.
colors:
  primary: '#0f766e'
  primary-strong: '#115e59'
  primary-on-dark: '#2dd4bf'
  text-strong: '#1f2328'
  text: '#24292f'
  text-muted: '#57606a'
  neutral-bg: '#fafafa'
  neutral-surface: '#f6f8fa'
  neutral-panel: '#ffffff'
  neutral-border: '#d0d7de'
  neutral-border-strong: '#afb8c1'
  dark-text-strong: '#f0f6fc'
  dark-text: '#e6edf3'
  dark-text-muted: '#8b949e'
  dark-bg: '#161b22'
  dark-surface: '#1c2129'
  dark-panel: '#0d1117'
  dark-border: '#30363d'
  dark-border-strong: '#484f58'
  success: '#1a7f37'
  error: '#cf222e'
  error-dark: '#ff7b72'
typography:
  display:
    fontFamily: '-apple-system, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans", sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  title:
    fontFamily: '-apple-system, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans", sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '-0.01em'
  body:
    fontFamily: '-apple-system, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans", sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0'
  label:
    fontFamily: '-apple-system, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans", sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: '0.01em'
  mono:
    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Consolas, monospace'
    fontSize: '0.8125rem'
    lineHeight: 1.5
rounded:
  sm: '6px'
  md: '8px'
  pill: '999px'
spacing:
  xxs: '4px'
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-toolbar:
    backgroundColor: 'transparent'
    textColor: '{colors.text}'
    rounded: '{rounded.sm}'
    padding: '6px 12px'
  button-toolbar-hover:
    backgroundColor: '{colors.neutral-surface}'
    textColor: '{colors.text-strong}'
  button-toolbar-active:
    backgroundColor: '{colors.neutral-border}'
    textColor: '{colors.text-strong}'
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '6px 14px'
  button-primary-hover:
    backgroundColor: '{colors.primary-strong}'
  input-checkbox:
    accentColor: '{colors.primary}'
---

# Design System: Markdown-Studio

## Overview

**Creative North Star: "The Quiet Studio"**

Markdown-Studio is a writing surface where the tool disappears into the task. It speaks the language of a calm, professional workbench: flat neutral ground, one restrained accent reserved for action and state, hairline separations instead of card stacks, and a typography system tuned to screen work rather than billboards. The interface must never compete with the document being written; it recedes so the artifact leads.

This is a deliberate refusal of the saturated AI pattern the upstream inherit, one in which the toolbar and panels advertise themselves through gray-on-dark chrome and heavy color. Here, depth is expressed with tonal layering (slightly cooler surfaces behind active content) and a single hairline border, never with shadow-field cards. Density is compact but not cramped, and every interactive element ships the full state set — default, hover, focus, active, and the theme-appropriate treatment.

**Key Characteristics:**

- Flat by default; tonal layering, not shadow cards.
- One restrained accent; used for action, focus, selection and state only.
- Hairline borders (1px) for panel separation.
- System-first type stack — familiar sans for UI, mono for code.
- Compact spacing rhythm (4/8/12/16) for a dense-but-calm tool.

## Colors

A restrained palette with cool neutrals and a single petrol-teal accent. Light theme uses paper-white panels on a subtly gray app ground; dark theme keeps the same roles with dimmer surfaces.

### Primary

- **Petrol Teal** (`#0f766e`): primary action, focus ring, checkbox accent, links in preview chrome, selection state. On dark, brightens to **Petrol Glow** (`#2dd4bf`) for legibility.
- **Petrol Deep** (`#115e59`): hover/pressed state of primary.

### Neutral

- **Paper** (`#ffffff`): active editor/preview panels (light).
- **Studio Fog** (`#fafafa`): app background (light); sits behind panels.
- **Studio Mist** (`#f6f8fa`): toolbar hover, dividers tone, subtle fills (light).
- **Ink** (`#24292f`): primary text (light).
- **Ink Soft** (`#57606a`): secondary text (light).
- **Ink Pale** (`#afb8c1`): disabled text, serpentine hairline accents (light).
- **Struct** (`#d0d7de`): hairline borders (light).
- Dark equivalents: **Night Canvas** (`#161b22`) app bg, **Night Panel** (`#0d1117`) panels, **Night Mist** (`#1c2129`) hover fills, **Moon** (`#e6edf3`) text, **Moon Muted** (`#8b949e`) secondary, **Night Struct** (`#30363d`) hairlines.

### Named Rules

**The One Voice Rule.** The petrol accent appears on ≤10% of any visible surface. Its rarity is what tells the user where to act; overusing it turns the tool into decoration.

**The Gray-On-Gray Rule.** Secondary text is tinted from the neutral foreground (`Ink Soft` / `Moon Muted`), never a flat gray dropped on a colored surface. No gray text on tinted backgrounds.

## Typography

**UI Font:** System first — `-apple-system, "Segoe UI", "SF Pro Text", system-ui, "Noto Sans"` (fallback sans-serif).
**Display Font:** same stack, weight 600, used only for the product wordmark/logo.
**Label/Mono Font:** `ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Consolas` for code and data.

**Character:** The face is deliberately unopinionated: a workhorse sans that belongs to every OS and betrays no training-data tell. It reads professional, not templated. Headings earn weight shifts and tight tracking, never a display face or gradient.

### Hierarchy

- **Display** (600, `1.5rem`, 1.2, `-0.02em`): product name in the toolbar. Rare.
- **Title/Section** (600, `1rem`, 1.4, `-0.01em`): pane labels, buttons, small headings.
- **Body** (400, `0.875rem`, 1.5): UI content, menu items, preview chrome.
- **Label** (500, `0.8125rem`, 1.3, `0.01em`): checkbox labels, toolbar captions.
- **Mono** (400, `0.8125rem`, 1.5): code listings, keyboard hints, file names.

### Named Rules

**The Fixed Scale Rule.** UI type uses fixed rem steps, not fluid clamps. The tool is viewed at constant DPI; fluid headings inside a sidebar look wrong, not responsive.

**The Custom-Line Rule.** `markdown-body` content keeps its own documented measure (65–75ch); UI chrome never widens to exceed its pane.

## Layout

Two-pane studio layout on wide screens: editor (`#edit`) and preview (`#preview`) share the workspace split by a 5px grab divider with a centered 1px hairline that widens to a tonal grip on hover/active. The top toolbar is a 48px band: product wordmark left, actions right, separated by a 1px hairline `Struct` border. The workspace itself is borderless flat; the divider is the only seam between panes.

On narrow screens (≤720px), panes **stack vertically** — structural collapse, not fluid typography: the divider becomes a horizontal seam, and each pane takes a fixed half-height of the workspace with its own scroll. Nothing changes in type.

Spacing rhythm is `4px × n`:

- 8px between toolbar items, 16px between header and workspace edge, 24px padding around preview content, 16px margin around diagram blocks (`mermaid`).
- "More space above a heading than below it" — section headings in `markdown-body` follow the CSS already provided by `github-markdown`.

## Elevation & Depth

Flat. The system conveys depth **only** through tonal layering and a single hairline: the active editor/preview panel sits one step lighter (`Paper`/`Night Panel`) than the app ground (`Studio Fog`/`Night Canvas`), and toolbar hover raises a panel-tone fill (`Studio Mist`/`Night Mist`) rather than a shadow. There are **no box-shadows** in the system; a surface that needs separation gets a `1px` hairline or a tone step.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. The tint change is the hover/active feedback; shadows never decorate controls.

## Shapes

Gently curved edges. Radius `6px` (`sm`) for all interactive controls (toolbar buttons, checkbox, focus rings). Radius `8px` (`md`) for large surfaces that occasionally carry a border (mermaid containers, error blocks). Fully rounded `999px` (`pill`) is reserved for status dots only. Corners stay quiet so the content, not the chrome, carries the shape grammar.

## Components

### Toolbar Buttons

- **Shape:** text buttons, `6px` radius, `6px 12px` padding.
- **Default:** transparent bg, `Ink`/`Moon` text at `0.875rem`.
- **Hover:** `Studio Mist`/`Night Mist` fill, `Ink Strong` text.
- **Active/Pressed:** `Struct`/`Night Struct` fill.
- **Focus:** `2px` `Petrol` ring, `2px` offset.
- Toolbar buttons are ghost actions. The one labeled **Export** may be promoted to `button-primary` when the output is the task at hand; otherwise keep the whole toolbar uniform.

### Checkboxes (toolbar)

- **Style:** accent-color `Petrol Teal` (`#0f766e`); label at `Label` size, `Ink Soft`/`Moon Muted`, checked text `Ink`/`Moon`.
- **State:** default → `:hover` → `:focus-visible` ring → `:checked` accent.

### Split Divider

- **Style:** 5px hot region, transparent center, `1px` inline hairline `Struct`/`Night Struct`.
- **State:** `:hover` widens hairline to `Charcoal` (`#afb8c1`/`#484f58`); `:active` uses the petrol **tone** (`#768390`) without painting the accent.

### Mermaid Container

- **Corner:** `8px`.
- **Background:** transparent (inherits pane).
- **Border:** `1px` hairline `Struct`/`Night Struct` only when in error state.
- **Internal Padding:** `16px`; overflow-x auto; SVG centered with `max-width: 100%`.

### Inputs / Fields

- N/A in v1 chrome (no free-text inputs besides the Monaco editor pane, which keeps Monaco's own chrome). Checkbox follows the rule above.

### Navigation

- The toolbar **is** the navigation: wordmark left, actions right, no menu drawer. On mobile, actions compress by label, keeping icon-less text buttons that remain tappable (≥36px height).

## Do's and Don'ts

### Do:

- **Do** use the petrol accent for one thing at a time — focus, selection, or primary action — never in bulk.
- **Do** separate panels with the hairline divider, not borders around each pane.
- **Do** keep UI type on a fixed rem scale (0.8125–1.5rem); no clamps in chrome.
- **Do** give every interactive element default / hover / focus-visible / active states.
- **Do** tint secondary text from the neutral foreground (`Ink Soft`/`Moon Muted`).

### Don't:

- **Don't** use pure black or pure gray text (`#000`/`#808080`); use `Ink`/`Moon` neutrals.
- **Don't** put cards inside the workspace; the studio is flat-tonal, not card-stacked.
- **Don't** use `Arial`, `Helvetica`, or `Inter` first in a font stack (overused, template-tell).
- **Don't** add box-shadows to controls or panels.
- **Don't** animate with bounce/elastic easing; state transitions are 150–250ms on transform/color/background.
- **Don't** render gray-on-gray or gray-on-tint secondary labels.
