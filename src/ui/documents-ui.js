import { t } from '../i18n/index.js';
import {
  listDocuments,
  getActiveDocument,
  createDocument,
  updateTitle,
  setActive,
  deleteDocument,
  setContent,
} from '../documents.js';

function uniqueName(base, existingNames, excludeId = null) {
  const trimmed = (base || '').trim().slice(0, 128) || t('docDefaultName');
  const lower = trimmed.toLowerCase();
  let candidate = trimmed;
  let counter = 2;
  while (existingNames.some((n) => n.toLowerCase() === lower && n !== excludeId)) {
    candidate = `${trimmed} (${counter})`;
    counter++;
  }
  return candidate;
}

export function setupDocumentManager({
  container = document,
  editor,
  getContent,
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

  let currentDoc = getActiveDocument();
  if (!currentDoc) {
    currentDoc = createDocument({ title: t('docDefaultName') });
  }

  function renderList() {
    const docs = listDocuments();
    const active = getActiveDocument();
    listEl.innerHTML = '';
    for (const doc of docs) {
      const li = document.createElement('li');
      li.className = 'doc-item';
      if (doc.id === active?.id) {
        li.setAttribute('aria-current', 'true');
        li.classList.add('doc-active');
      }
      li.setAttribute('tabindex', '0');
      li.setAttribute('role', 'button');
      li.dataset.docId = doc.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'doc-name';
      nameSpan.textContent = doc.title || t('docUntitled');
      li.appendChild(nameSpan);

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
        } else {
          handleSwitch(doc.id);
        }
      });

      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (e.target.dataset.docClose) {
            handleClose(doc.id);
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

  function saveCurrentContent() {
    if (currentDoc && getContent) {
      const content = getContent();
      setContent(currentDoc.id, content);
    }
  }

  function loadDocument(doc) {
    if (!doc) return;
    currentDoc = doc;
    if (editor && typeof editor.setValue === 'function') {
      const content = getContent(doc.id) ?? '';
      editor.setValue(content);
      editor.revealPosition({ lineNumber: 1, column: 1 });
    }
    renderList();
  }

  function handleSwitch(id) {
    if (id === currentDoc?.id) return;
    saveCurrentContent();
    const doc = listDocuments().find((d) => d.id === id);
    if (doc) {
      setActive(doc.id);
      loadDocument(doc);
    }
  }

  function handleClose(id) {
    const docs = listDocuments();
    if (docs.length <= 1) {
      return;
    }
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;

    if (confirm) {
      const confirmed = confirm(t('newFileConfirm'));
      if (!confirmed) return;
    }

    saveCurrentContent();
    deleteDocument(id);

    const remaining = listDocuments();
    const active = getActiveDocument();
    if (active) {
      loadDocument(active);
    } else if (remaining.length === 0) {
      const newDoc = createDocument({ title: t('docDefaultName') });
      loadDocument(newDoc);
    }
  }

  function handleCreate() {
    saveCurrentContent();
    const docs = listDocuments();
    const names = docs.map((d) => d.title);
    const title = uniqueName(t('docDefaultName'), names);
    const doc = createDocument({ title, initialContent: '' });
    loadDocument(doc);
    onStatus?.(t('fileOpened').replace('{name}', title));
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
    const finalName = uniqueName(trimmed, names, doc.id);
    updateTitle(doc.id, finalName);
    renderList();
    onStatus?.(t('fileSaved').replace('{name}', finalName));
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
