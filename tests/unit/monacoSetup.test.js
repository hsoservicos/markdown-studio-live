import { describe, it, expect, vi } from 'vitest';

vi.mock('monaco-editor', () => ({ __esModule: true, editor: {} }));

// O corpo do módulo roda UMA vez (cache de ESM), então tudo que ele faz —
// `self.MonacoEnvironment` e o reexport — é verificado em um único teste.
describe('monacoSetup', () => {
  it('instala um getWorker no-op e reexporta o monaco', async () => {
    const { monaco } = await import('../../src/ui/workers/monacoSetup.js');

    expect(monaco.editor).toBeDefined();
    expect(self.MonacoEnvironment).toBeDefined();
    expect(typeof self.MonacoEnvironment.getWorker).toBe('function');

    const worker = self.MonacoEnvironment.getWorker('fakeId', 'json');
    expect(typeof worker.get).toBe('function');
    expect(worker.get()).toBeUndefined();
    expect(typeof worker.postMessage).toBe('function');
    expect(worker.postMessage({ any: 'thing' })).toBeUndefined();
  });
});
