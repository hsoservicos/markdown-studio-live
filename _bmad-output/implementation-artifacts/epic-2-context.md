# Epic 2 Context: Múltiplos documentos locais (P2-10)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to open, create, and switch between multiple Markdown documents within a single session, all persisted locally with the same privacy guarantees as the current single-document model. This replaces the implicit assumption that one localStorage key holds the entire user workspace, requiring a versioned document index and content-per-id schema that must not break existing single-document sessions or the `last_state`/`backup` contracts.

## Stories

- Story 2.1: Índice de documentos no storage
- Story 2.2: Gerenciador de documentos (`src/ui/documents.js`)
- Story 2.3: Ações do editor operando no documento ativo
- Story 2.4: Persistência do documento corrente no boot

## Requirements & Constraints

- All persistence uses localStorage only (`com.markdownstudio.*` keys); no backend, no external calls at runtime (100% client-side, offline after build).
- Document index schema: `{ version: 1, activeId, documents: [{ id, title, updatedAt }] }` at `com.markdownstudio.documents`; content per id at `com.markdownstudio.documents.content.<id>`.
- `documents.*` is the source of truth at boot; `last_state` mirrors the active document for backward compatibility.
- Legacy `last_state` (non-template, pre-P2) is converted into a document ("Documento restaurado") on first P2 load without removing the original until migration is confirmed.
- Legacy `com.markdownstudio.backup` is attributed to the active document on first P2 load or kept in a "legado" root — never orphaned.
- Index + content writes must be atomic: if one fails, neither is applied.
- `safeGet` must be extended with `type: 'object'` validation for index reads.
- IDs generated via `crypto.randomUUID()` with `Date.now() + Math.random()` fallback; never derived from titles.
- Duplicate IDs in a corrupt index are deduplicated keeping the most recent `updatedAt`, with an i18n warning.
- `QuotaExceededError` triggers an i18n warning and preserves the last saved version intact.
- `SecurityError` (private browsing with storage disabled) is caught and reported via `aria-live` with i18n warning, no crash.
- Empty/corrupt index, orphaned active ID, or corrupt individual content degrades gracefully with i18n warnings, no crash.
- Document names: trimmed, non-empty, max 128 characters, unique with automatic numeric suffix on collision (`Documento`, `Documento (2)`, …); suffix also applied on rename.
- Closing the active document promotes the next in list (or opens the template if empty).
- Confirmation required before discarding unsaved content (`newFileConfirm` pattern).
- List is keyboard-operable with `aria-current` on the active item; visible focus indicator.
- All editor actions (Copy, Export PDF, Export HTML, Snapshots) operate on the active document's content and name; filenames sanitized for download.
- Snapshots store origin (document id + label); legacy snapshots without origin are attributed to the active document or kept in "legado" root.
- Deleting a document migrates its snapshots to the active document or removes them with confirmation — no orphaned origins.
- Boot restores the document list and reopens the active document from the previous session.

## Technical Decisions

- Storage layout is two-key per document: the index object and a separate string key per content id. This keeps reads and writes atomic at the localStorage level without transactions.
- The index version field (`version: 1`) enables future schema migrations without breaking stored data.
- `last_state` continues to function as a mirror of the active document's content, preserving existing P0 save/restore flows during and after migration.
- Editor actions must look up the active document from the index before operating; they cannot assume a single hardcoded storage key.
- Graceful degradation is critical at every storage boundary: `safeGet` for reads, try/catch on writes, and `aria-live` for all user-facing error messages.

## UX & Interaction Patterns

- Document manager UI lives in `src/ui/documents.js` (sidebar list/tabs).
- Active document name appears in the status bar (P0-3) and in save/open flows.
- Confirmation dialog before discarding unsaved content uses the existing `newFileConfirm` pattern.
- All error states (quota, security, corruption) report via `aria-live` regions with i18n-translated messages.

## Cross-Story Dependencies

- Story 2.1 (storage index) is the foundation; Stories 2.2, 2.3, and 2.4 all depend on it.
- Story 2.2 (UI manager) depends on 2.1 and is consumed by Story 2.3 (editor actions scope to active document).
- Story 2.4 (boot persistence) depends on 2.1 and must handle the pre-P2 → P2 migration path that Story 2.1 defines.
- Epic 2 as a whole does not depend on Epic 1 (PDF vetorial); they are independent feature tracks.
