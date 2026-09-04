---
title: 'Paridade de contrato e fallback PDF vetorial'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - src/ui/exportPdf.js
  - src/ui/exportPdfVector.js
  - tests/unit/exportPdf.test.js
  - tests/unit/exportPdfVector.test.js
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A rota vetorial pode falhar (pdfmake indisponível, erro de renderização). Precisa de fallback transparente para a rota rasterizada, mantendo o contrato B5 (erro no canal aria-live, sem prompt duplo).

**Approach:** (1) `exportPdfVector` captura erros e delega para `exportPreviewToPdf` raster; (2) testes unitários cobrem sucesso, erro de lib, erro de renderização, e fallback; (3) feature-flag testada em todos os estados.

## Boundaries & Constraints

**Always:** Fallback transparente (usuário vê PDF, não erro); B5 (canal único aria-live); feature-flag default off; testes com mock (sem rede); quality gate verde

**Ask First:** Mudança no default da feature-flag

**Never:** Remoção do fallback rasterizado; exposição de erros técnicos ao usuário

</frozen-after-approval>

## Code Map

- `src/ui/exportPdf.js` -- Router: checa flag, delega para vector ou raster. Fallback precisa ser chamado quando vector falha
- `src/ui/exportPdfVector.js` -- Rota vetorial: captura erros e reporta via onStatus. Precisa delegar para raster no catch
- `tests/unit/exportPdf.test.js` -- Testes do raster: mock html2pdf, sucesso/erro. Padrão para novos testes
- `tests/unit/exportPdfVector.test.js` -- Testes da flag: isVectorPdfEnabled, setVectorPdfEnabled. Precisa de testes de export

## Tasks & Acceptance

**Execution:**
- [x] `src/ui/exportPdfVector.js` -- No catch, chamar fallback rasterizado (importar e chamar `exportRasterFallback`)
- [x] `src/ui/exportPdf.js` -- Extrair lógica raster para `exportRasterFallback` exportada (reutilizável pelo vector)
- [x] `tests/unit/exportPdf.test.js` -- Adicionar testes: flag off→raster; vector falha→raster fallback
- [x] `tests/unit/exportPdfVector.test.js` -- Adicionar testes: sucesso do vector, erro de lib, erro de renderização

**Acceptance Criteria:**
- Given feature-flag desabilitada, when export PDF, then rota raster é usada (comportamento atual preservado)
- Given feature-flag habilitada e pdfmake ok, when export PDF, then rota vetorial é usada
- Given feature-flag habilitada e pdfmake falha, when export PDF, then fallback para raster com status `pdfUnavailable`
- Given feature-flag habilitada e erro de renderização, when export PDF, then fallback para raster com status `exportError`
- Given erro em qualquer rota, when status é reportado, then é no canal aria-live (sem dialog)
- Given quality gate, when roda `npm run quality`, then verde

## Verification

**Commands:**
- `npm run quality` -- expected: verde (279+ tests)
- `npm run build` -- expected: build OK

**Manual checks:**
- `exportRasterFallback` é exportada de `exportPdf.js` e chamada pelo `exportPdfVector` no catch
- Testes cobrem: flag off→raster, flag on→vector, vector erro→raster fallback
