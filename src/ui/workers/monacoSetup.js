import * as monaco from 'monaco-editor';

// A linguagem 'markdown' do Monaco é tokenizada na main thread e não usa web
// worker. Um no-op evita que o Monaco tente carregar workers pesados (JSON/TS)
// que este projeto não utiliza — mantendo o bundle enxuto e 100% local.
self.MonacoEnvironment = {
  getWorker(_workerId, _label) {
    return new Proxy({}, { get: () => () => {} });
  },
};

export { monaco };
