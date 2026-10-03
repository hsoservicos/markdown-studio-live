import { t } from '../i18n/index.js';
import { classifyError } from '../documents.js';

/**
 * Mensagem i18n para uma falha de gravação no localStorage.
 *
 * Existe porque os pontos de gravação não têm dono para tratar a exceção:
 * o autosave roda dentro de um `setTimeout` e as ações da UI correm em
 * handlers de evento — em ambos, uma `StorageError` virava erro silencioso
 * no console e o usuário só descobria a perda no próximo reload.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function storageFailureMessage(error) {
  switch (classifyError(error)) {
    case 'quota':
      return t('quotaExceeded');
    case 'security':
      return t('storageDisabled');
    default:
      return t('saveFailed');
  }
}

/**
 * Executa `fn` capturando a falha de storage.
 *
 * Devolve `true` quando `fn` completou e `false` quando lançou — o chamador
 * usa o retorno para abortar a operação seguinte (trocar de documento sem
 * ter salvo o anterior, por exemplo, descartaria o que estava no editor).
 *
 * O retorno é sobre a *exceção*, não sobre o valor que `fn` devolveu: há
 * domínios em que `false` significa sucesso ("esse id já não existe" num
 * delete) e outros em que significa recusa. Quem precisa do booleano captura
 * dentro do callback em vez de depender daqui.
 *
 * @param {() => unknown} fn
 * @param {{ onFail?: (message: string, error: unknown) => void }} [options]
 * @returns {boolean}
 */
export function guardStorage(fn, { onFail } = {}) {
  try {
    fn();
    return true;
  } catch (error) {
    const message = storageFailureMessage(error);
    console.error('[storage]', message, error);
    onFail?.(message, error);
    return false;
  }
}
