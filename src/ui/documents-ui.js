import { t, getDefaultTemplate } from '../i18n/index.js';
import {
  listDocuments,
  getActiveDocument,
  createDocument,
  updateTitle,
  setActive,
  deleteDocument,
  setContent,
  // `getContent` do storage de documentos — NÃO confundir com o getter do
  // editor que este módulo recebe em `getEditorContent`. As duas funções
  // tinham o mesmo nome e o shadowing fazia `loadDocument` carregar o conteúdo
  // atual do editor em vez do conteúdo do documento alvo.
  getContent as getDocumentContent,
} from '../documents.js';
import { reassignDocSnapshots, migrateLegacySnapshots } from './snapshots.js';
import { guardStorage as guardStorageCall } from './storageFeedback.js';

/**
 * Devolve um nome livre a partir de `base`, sufixando `(2)`, `(3)`… quando
 * necessário. `currentName` permite renomear um documento para o próprio nome
 * (ou variando a caixa) sem gerar sufixo.
 *
 * @param {string} base
 * @param {string[]} existingNames
 * @param {string|null} currentName
 */
export function uniqueName(base, existingNames = [], currentName = null) {
  const trimmed = (base || '').trim().slice(0, 128) || t('docDefaultName');
  const skip = (currentName || '').trim().toLowerCase();
  const taken = new Set(
    existingNames.filter(Boolean).map((name) => String(name).trim().toLowerCase()),
  );
  if (skip) {
    taken.delete(skip);
  }
  if (!taken.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  let counter = 2;
  let candidate = `${trimmed} (${counter})`;
  while (taken.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${trimmed} (${counter})`;
  }
  return candidate;
}

export function setupDocumentManager({
  container = document,
  editor,
  getEditorContent,
  onStatus,
  confirm,
} = {}) {
  if (!container || !editor) {
    return null;
  }

  const listEl = container.querySelector('#document-list');
  if (!listEl) {
    return null;
  }

  // Toda gravação passa por aqui: o localStorage pode estourar a quota e, sem
  // isto, a exceção abortava o handler de evento em silêncio — o clique
  // "parecia não fazer nada" e o usuário só descobria no reload.
  const guardStorage = (fn) => guardStorageCall(fn, { onFail: (message) => onStatus?.(message) });

  let currentDoc = getActiveDocument();
  if (!currentDoc) {
    // Boot sem documento no índice: semeia o documento com o conteúdo que o
    // boot já colocou no editor. Carregar um documento vazio aqui apagaria o
    // template/estado inicial do Monaco.
    // Se a gravação falhar (quota), `currentDoc` fica null: o gerenciador segue
    // funcional e a criação de um documento novo é o caminho de recuperação.
    guardStorage(() => {
      currentDoc = createDocument({
        title: t('docDefaultName'),
        initialContent: String(getEditorContent?.() ?? ''),
      });
    });
  }
  // B6 (AC-P2-10-3): snapshots legados sem origem (pré-P2) são atribuídos ao
  // documento ativo na migração — nunca ficam pendurados.
  if (currentDoc) {
    guardStorage(() => migrateLegacySnapshots(currentDoc.id));
  }

  function renderList() {
    const docs = listDocuments();
    const active = getActiveDocument();
    listEl.innerHTML = '';
    for (const doc of docs) {
      // C6: `ul`/`li` reais (o container era `div` com `li` soltos) e sem
      // `role="button"` no `li` — botões dentro de role=button são controle
      // interativo aninhado. O nome vira botão (ação: trocar de documento).
      const li = document.createElement('li');
      li.className = 'doc-item';
      if (doc.id === active?.id) {
        li.setAttribute('aria-current', 'true');
        li.classList.add('doc-active');
      }
      li.setAttribute('tabindex', '0');
      li.dataset.docId = doc.id;

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'doc-name';
      nameBtn.textContent = doc.title || t('docUntitled');
      li.appendChild(nameBtn);

      // B3 (AC-P2-10-2): renomear precisa existir na UI — antes `handleRename`
      // só vivia no retorno do setup, que ninguém consumia.
      const renameBtn = document.createElement('button');
      renameBtn.className = 'doc-rename-btn';
      renameBtn.type = 'button';
      renameBtn.textContent = '✎';
      renameBtn.title = t('docRename');
      renameBtn.setAttribute('aria-label', t('docRename'));
      renameBtn.dataset.docRename = doc.id;
      li.appendChild(renameBtn);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'doc-close-btn';
      closeBtn.type = 'button';
      closeBtn.textContent = '×';
      closeBtn.title = t('docClose');
      closeBtn.setAttribute('aria-label', t('docClose'));
      closeBtn.dataset.docClose = doc.id;
      li.appendChild(closeBtn);

      li.addEventListener('click', (e) => {
        if (e.target.dataset.docClose) {
          handleClose(doc.id);
        } else if (e.target.dataset.docRename) {
          handleRename(doc.id);
        } else {
          handleSwitch(doc.id);
        }
      });

      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (e.target.dataset.docClose) {
            handleClose(doc.id);
          } else if (e.target.dataset.docRename) {
            handleRename(doc.id);
          } else {
            handleSwitch(doc.id);
          }
        }
        if (e.key === 'Delete') {
          handleClose(doc.id);
        }
      });

      listEl.appendChild(li);
    }
  }

  /** @returns {boolean} `false` quando a gravação falhou (mensagem no status). */
  function saveCurrentContent() {
    if (!currentDoc || !getEditorContent) return true;
    return guardStorage(() => setContent(currentDoc.id, getEditorContent()));
  }

  function loadDocument(doc) {
    if (!doc) return;
    currentDoc = doc;
    if (editor && typeof editor.setValue === 'function') {
      editor.setValue(getDocumentContent(doc.id) ?? '');
      editor.revealPosition({ lineNumber: 1, column: 1 });
    }
    renderList();
  }

  function handleSwitch(id) {
    if (id === currentDoc?.id) return;
    // Se o save falhou, trocar de documento descartaria o que está no editor:
    // aborta e deixa a explicação no status.
    if (!saveCurrentContent()) return;
    const doc = listDocuments().find((d) => d.id === id);
    if (doc) {
      let activated = false;
      if (
        !guardStorage(() => {
          activated = setActive(doc.id);
        })
      ) {
        return;
      }
      // M8: o guard só enxerga exceções, então o `false` do `setActive` (o id
      // saiu do índice — outra aba mexeu) passava direto e a UI trocava para
      // um documento que o storage não considerava ativo: no reload o anterior
      // voltava por cima.
      if (!activated) {
        onStatus?.(t('docOpRefused'));
        return;
      }
      loadDocument(doc);
    }
  }

  function handleClose(id) {
    const docs = listDocuments();
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;

    if (confirm) {
      const confirmed = confirm(t('docCloseConfirm'));
      if (!confirmed) return;
    }

    if (!saveCurrentContent()) return;

    // B7: `deleteDocument` devolve false quando o documento sumiu do índice
    // (outra aba mexeu) — sem capturar o booleano a UI anunciava sucesso para
    // um fechamento que não aconteceu.
    let deleted = false;
    if (
      !guardStorage(() => {
        deleted = deleteDocument(id);
      }) ||
      !deleted
    ) {
      onStatus?.(t('docOpRefused'));
      renderList();
      return;
    }

    // B6 (AC-P2-10-3): snapshots do documento fechado migram para o ativo
    // seguinte — sem origem pendurada.
    reassignDocSnapshots(id, getActiveDocument()?.id ?? null);

    if (currentDoc?.id === id) {
      currentDoc = null;
    }

    const remaining = listDocuments();
    const active = getActiveDocument();
    if (active && active.id !== currentDoc?.id) {
      loadDocument(active);
    } else if (active) {
      // M4: fechar uma linha em segundo plano deixa `active` como o próprio
      // documento já aberto. Recarregá-lo aqui seria `setValue` com o mesmo
      // texto — que no Monaco limpa o undo stack e destrói decorações — e
      // `revealPosition(1,1)` jogaria o viewport para o topo, sem ganho algum.
      renderList();
    } else if (remaining.length === 0) {
      // B4 (AC-P2-10-2): a lista esvaziou — abre o template do idioma
      // corrente. Antes o guard `docs.length <= 1` recusava em silêncio o
      // fechamento do último documento e este ramo era inalcançável.
      guardStorage(() => {
        currentDoc = createDocument({
          title: t('docDefaultName'),
          initialContent: getDefaultTemplate(),
        });
      });
      if (currentDoc) {
        loadDocument(currentDoc);
      } else {
        // Reposição falhou: a lista ainda mostra o documento apagado.
        renderList();
      }
    }
  }

  function handleCreate() {
    if (!saveCurrentContent()) return;
    const docs = listDocuments();
    const names = docs.map((d) => d.title);
    const title = uniqueName(t('docDefaultName'), names);
    let doc = null;
    if (
      !guardStorage(() => {
        doc = createDocument({ title, initialContent: '' });
      })
    ) {
      return;
    }
    loadDocument(doc);
    // C3: "Arquivo aberto" era a mensagem para um documento RECÉM-CRIADO.
    onStatus?.(t('docCreated').replace('{name}', title));
  }

  function handleRename(id) {
    const doc = listDocuments().find((d) => d.id === id);
    if (!doc) return;

    const newName = window.prompt(t('docRename'), doc.title);
    if (newName === null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      onStatus?.(t('docEmpty'));
      return;
    }

    const docs = listDocuments();
    const names = docs.map((d) => d.title);
    const finalName = uniqueName(trimmed, names, doc.title);
    let renamed = false;
    if (
      !guardStorage(() => {
        renamed = updateTitle(doc.id, finalName);
      })
    ) {
      return;
    }
    // M8: `updateTitle` devolve false quando o documento sumiu do índice —
    // aqui há um `prompt` aberto, então há uma janela real de outra aba apagar.
    // Sem capturar o booleano o guard devolvia true e a UI anunciava "salvo"
    // para um nome que nunca foi gravado.
    if (!renamed) {
      onStatus?.(t('docOpRefused'));
      renderList();
      return;
    }
    renderList();
    onStatus?.(
      finalName === trimmed
        ? t('fileSaved').replace('{name}', finalName)
        : `${t('docNameConflict')} ${finalName}`,
    );
  }

  renderList();

  const newBtn = container.querySelector('#doc-new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', handleCreate);
  }

  return {
    refresh: renderList,
    create: handleCreate,
    switchTo: handleSwitch,
    rename: handleRename,
    getCurrent: () => currentDoc,
  };
}
