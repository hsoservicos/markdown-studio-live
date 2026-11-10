# O teste de autonomia

Quem responde a esta decisão: você ou o operador?

O padrão é **o operador**. Este teste existe para deixar passar a minoria que a
documentação já resolveu — não para justificar uma maioria. Se ao aplicá-lo você
estiver tomando metade da fila, você o aplicou errado: quase nenhuma decisão que
um triage classificou como "um humano precisa escolher" é sua.

O modo `[A]` usa este arquivo. O modo `[D]` também: a linha "eu responderia esta
sozinha" no resumo do dossiê sai daqui, e o operador precisa poder discordar dela.

## As quatro condições — todas, não a maioria

**1. Fonte citável, verbatim.** Arquivo, seção, e a passagem **transcrita** no
relatório. "O PRD sugere", "a doutrina aponta para", "pelo que li do módulo" não
são fontes: são a sua leitura com a autoridade de outra pessoa. Se você não
consegue colar o parágrafo, não há fonte.

`exige_citacao_verbatim` no `rules.toml` liga a exigência de transcrever; com ela
desligada você ainda precisa da passagem — a chave só decide se ela vai para o
documento, e o padrão é ir.

**2. A fonte vence a entrada.** Datas importam. Um documento de junho não resolve
uma entrada de agosto que o contradiz — a entrada é a notícia mais nova. Compare
a data de `origin:` da entrada com a última mudança do documento:

```bash
git -C <raiz> log -1 --format='%ad %h %s' --date=short -- <documento>
```

Documento mais velho que a entrada e em conflito com ela: a decisão é do
operador, e o conflito é o achado — pode ser o documento que envelheceu.

**3. Não sobrou trade-off.** Se a escolha depende de custo, prazo, escopo ou
apetite a risco, ela é do humano. Documento não tem apetite a risco.

O teste prático: **nomeie o lado que perde e diga por que a perda é aceitável.**
Se a frase "é aceitável porque" só fecha com uma preferência — "não vale o
esforço agora", "dá para viver com isso" — a preferência é do operador e você
acabou de inventá-la.

**4. Sem precedente contraditório.** As linhas `decision:` de outras entradas do
ledger são jurisprudência deste projeto.

```bash
grep -n '^decision:' <ledger>          # todas as respostas já dadas, em ordem
```

Uma decisão que contradiz outra respondida semana passada é **um achado para
levantar**, nunca um fato para enterrar. Ela vai para o bloco de contradições, no
topo do dossiê, e nunca é automática — nem para `keep-open`.

### E os portões do `rules.toml`, que vêm antes das quatro

- `severidade_maxima_automatica` — lida do `severity:` da **entrada no ledger**,
  não do tom da pergunta. `critical` e `high` vão para o humano mesmo com fonte
  perfeita.
- `permite_close_automatico` — `false` por padrão, e a tabela abaixo explica por
  quê.
- cada `[[prior]]` que casar — é doutrina que o operador sabe e nenhum documento
  escreveu. Um prior que casa **vence a sua leitura**, inclusive uma leitura
  apoiada em citação.

## A assimetria por efeito

Os três efeitos não erram igual, então não têm a mesma barra:

| Efeito      | Barra                        | Por quê                                                                                        |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `keep-open` | baixa                        | não fecha nada e não gasta nada; errar custa uma re-pergunta no próximo triage                 |
| `build`     | média                        | gasta uma sessão de dev; errar é token desperdiçado, e o diff ainda passa por review           |
| `close`     | **alta — na prática, nunca** | a entrada morre e o trabalho nunca acontece. É perda silenciosa: nada depois diz que se perdeu |

`close` automático é a única das três em que o erro não deixa rastro. Por isso o
padrão do `rules.toml` é `permite_close_automatico = false`, e por isso ligá-lo
não é permissão para usar: mesmo ligado, `close` sem o operador exige que as
quatro condições estejam **explícitas no documento** — não deduzidas de três
parágrafos combinados.

## O fallback: evidência forte, mas curta para `close`

É o caso mais comum de todos. Você leu, o documento quase resolve, e a resposta
natural seria fechar.

**Não feche. Responda `keep-open` e registre o achado.** Isso arquiva o que você
descobriu, não fecha nada, e o próximo triage começa mais perto — provavelmente
já com a pergunta certa, que é o que faltava.

Onde o achado mora: `decisions --answer` **não aceita texto livre**. A linha
`decision:` que o CLI grava no ledger carrega as palavras da própria opção e a
data. Então o achado vai no dossiê do dia — rastreado no git, com a data no nome
— e a linha `decision:` daquela data é o ponteiro para ele. Um `keep-open`
automático gravado sem dossiê registra duas palavras e perde a leitura inteira.

## Quando nenhuma opção serve

A discussão de um item pode concluir que a pergunta está mal formulada: as duas
opções pressupõem algo falso, ou a decisão real é outra, uma camada acima.

A saída é `keep-open` com o motivo registrado — **por que o enquadramento está
errado**, não "adiado". Assim o próximo triage reformula em vez de repetir.

Nunca force para a opção mais próxima. Um `build` forçado gasta uma sessão de dev
num objetivo que ninguém escolheu, e o ledger passa a registrar uma resposta que
nunca foi dada.

## Sinais rápidos

**É do operador**, mesmo com fonte na mão:

- a pergunta usa "deve" sobre política, não sobre fato
- as opções diferem em prazo, custo ou escopo — não em correção
- a entrada é `severity: critical` ou `high`
- a decisão reabre algo que um humano congelou (bloco `<frozen-after-approval>`,
  escopo aprovado, decisão de produto registrada)
- duas fontes de mesma autoridade discordam entre si
- o efeito escolhido seria `close`

**Pode ser sua:**

- a pergunta é factual e o documento a responde literalmente
- as opções diferem em correção, e uma delas é o que a doutrina já manda
- a entrada é `low` ou `medium`, e a opção é `keep-open` — ou um `build` cujo
  `intent` a doutrina já descreve com as mesmas palavras
- o código em `location:` **já implementa** uma das opções, e responder é
  registrar um fato consumado (confirme com `git log`, não com uma leitura)

## O que registrar por resposta automática

Sem isto, uma resposta automática é indistinguível de um chute, e ninguém
consegue auditar o lote depois:

1. o id (`DW-<n>`) e a chave da opção escolhida, com o efeito
2. arquivo e seção da fonte
3. a passagem transcrita
4. uma frase dizendo por que as outras opções perdem

Quatro itens. Se algum falta, a decisão não passou no teste — ela passou na sua
vontade de fechar a fila.
