import { describe, it, expect, afterEach, vi } from 'vitest';
import { storageFailureMessage, guardStorage } from '../../src/ui/storageFeedback.js';
import { StorageError } from '../../src/storage.js';
import { classifyError } from '../../src/documents.js';
import { setLocale, t } from '../../src/i18n/index.js';

afterEach(() => setLocale('pt-BR'));

describe('classifyError', () => {
  it('lê a causa do StorageError', () => {
    expect(classifyError(new StorageError('x', { name: 'QuotaExceededError' }))).toBe('quota');
    expect(classifyError(new StorageError('x', { name: 'SecurityError' }))).toBe('security');
    expect(classifyError(new StorageError('x', new Error('boom')))).toBe('generic');
  });

  it('aceita o DOMException cru do localStorage', () => {
    expect(classifyError({ name: 'QuotaExceededError' })).toBe('quota');
    expect(classifyError({ name: 'SecurityError' })).toBe('security');
    expect(classifyError(null)).toBe('generic');
  });
});

describe('storageFailureMessage', () => {
  it('fala em quota estourada quando é quota', () => {
    setLocale('pt-BR');
    const message = storageFailureMessage(
      new StorageError('Falha ao gravar', { name: 'QuotaExceededError' }),
    );
    expect(message).toBe(t('quotaExceeded'));
    expect(message).toContain('armazenamento cheio');
  });

  it('fala em armazenamento desabilitado quando é SecurityError', () => {
    setLocale('pt-BR');
    const message = storageFailureMessage(new StorageError('x', { name: 'SecurityError' }));
    expect(message).toBe(t('storageDisabled'));
  });

  it('cai numa mensagem genérica de salvamento nos demais casos', () => {
    setLocale('pt-BR');
    const message = storageFailureMessage(new StorageError('x'));
    expect(message).toBe(t('saveFailed'));
    expect(message).toBeTruthy();
  });

  it('traduz: as três mensagens existem em en e diferem do pt', () => {
    setLocale('pt-BR');
    const pt = [t('quotaExceeded'), t('storageDisabled'), t('saveFailed')];
    setLocale('en');
    const en = [t('quotaExceeded'), t('storageDisabled'), t('saveFailed')];

    expect(pt.every(Boolean)).toBe(true);
    expect(en.every(Boolean)).toBe(true);
    expect(en).not.toEqual(pt);

    expect(storageFailureMessage({ name: 'QuotaExceededError' })).toBe(en[0]);
    expect(storageFailureMessage({ name: 'SecurityError' })).toBe(en[1]);
    expect(storageFailureMessage(new Error('boom'))).toBe(en[2]);
  });
});

describe('guardStorage', () => {
  it('devolve true e não reporta quando a gravação passa', () => {
    const onFail = vi.fn();
    expect(guardStorage(() => 42, { onFail })).toBe(true);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('devolve false, reporta a mensagem e registra o erro quando falha', () => {
    const onFail = vi.fn();
    const error = new StorageError('Falha ao gravar', { name: 'QuotaExceededError' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      guardStorage(
        () => {
          throw error;
        },
        { onFail },
      ),
    ).toBe(false);

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(t('quotaExceeded'), error);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('devolve false mesmo sem callback onFail', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      guardStorage(() => {
        throw new Error('boom');
      }),
    ).toBe(false);
    log.mockRestore();
  });

  it('é o que a UI usa para não lançar: o retorno é booleano', () => {
    expect(guardStorage(() => null)).toBe(true);
    const quota = new Error('quota');
    quota.name = 'QuotaExceededError';
    expect(
      guardStorage(() => {
        throw quota;
      }),
    ).toBe(false);
  });
});
