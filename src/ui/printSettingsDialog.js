import {
  loadPrintSettings,
  savePrintSettings,
  applyPrintSettingsCss,
  DEFAULT_PRINT_SETTINGS,
} from './printSettings.js';

/**
 * Controla o diálogo de configuração de impressão: popula os campos com as
 * preferências salvas e aplica a folha de @page/print ao salvar.
 */
export function setupPrintSettingsDialog({ container = document, onSaved } = {}) {
  const dialog = container.querySelector('#print-settings-dialog');
  if (!dialog) {
    return null;
  }

  const fields = {
    margin: container.querySelector('#print-margin'),
    paperSize: container.querySelector('#print-paper'),
    orientation: container.querySelector('#print-orientation'),
    headerText: container.querySelector('#print-header'),
    footerText: container.querySelector('#print-footer'),
  };
  const form = container.querySelector('#print-settings-form');
  const closeButton = container.querySelector('#print-settings-close');

  function open() {
    const settings = loadPrintSettings();
    const reviverDecor = (field, value) => {
      if (field && value != null) {
        field.value = String(value);
      }
    };
    reviverDecor(fields.margin, settings.margin);
    reviverDecor(fields.paperSize, settings.paperSize);
    reviverDecor(fields.orientation, settings.orientation);
    reviverDecor(fields.headerText, settings.headerText);
    reviverDecor(fields.footerText, settings.footerText);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function submit(event) {
    event.preventDefault();
    const settings = savePrintSettings({
      margin: Number(fields.margin?.value) || DEFAULT_PRINT_SETTINGS.margin,
      paperSize: fields.paperSize?.value,
      orientation: fields.orientation?.value,
      headerText: fields.headerText?.value ?? '',
      footerText: fields.footerText?.value ?? '',
    });
    applyPrintSettingsCss(settings);
    onSaved?.(settings);
    close();
  }

  form?.addEventListener('submit', submit);
  closeButton?.addEventListener('click', close);

  return { open, close };
}
