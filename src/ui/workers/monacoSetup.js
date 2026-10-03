import * as monaco from 'monaco-editor';

// D5 (2026-10-03): o import do pacote `monaco-editor` COMPLETO (e não da entry
// `editor.api`) é decisão, não esquecimento — mantida por dois motivos:
//
// 1. Este módulo é carregado sob demanda (`import()` dinâmico em `main.js`):
//    os chunks do Monaco (~4 MB) ficam FORA do caminho crítico de boot e são
//    servidos como assets imutáveis (cache de 1 ano no nginx) — o custo é o
//    primeiro load, amortizado em todo acesso seguinte.
// 2. O modo markdown do Monaco usa os tokenizers das outras linguagens para
//    destacar blocos ` ```python `, ` ```js ` etc. dentro do documento —
//    trocar por `editor.api` (sem linguagens) degradaria a edição de Markdown
//    com código, que é o caso de uso principal do app.
//
// Se um dia o peso virar requisito, o caminho é extrair só as linguagens usadas
// em fenced blocks — nunca simplesmente apontar para `editor.api`.

// A linguagem 'markdown' do Monaco é tokenizada na main thread e não usa web
// worker. Um no-op evita que o Monaco tente carregar workers pesados (JSON/TS)
// que este projeto não utiliza — mantendo o bundle enxuto e 100% local.
self.MonacoEnvironment = {
  getWorker(_workerId, _label) {
    return new Proxy({}, { get: () => () => {} });
  },
};

export { monaco };
