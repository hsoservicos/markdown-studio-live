# O dossiê

O documento que o `[D]` escreve e o `[R]` lê. É o produto da skill: o prompt
bloqueante não tem onde pôr um trecho de código, um parágrafo de doutrina citado
e o custo de cada opção, e é exatamente disso que faltava para responder.

**Caminho:** `_bmad-output/decisoes-<YYYY-MM-DD>.md`, **rastreado no git** — é um
registro de decisão, e o projeto já guarda os escritos à mão ao lado. Se
`[fontes]` no `rules.toml` apontar os documentos do projeto para outro diretório,
escreva ao lado deles.

Duas rodadas no mesmo dia sobrescrevem o mesmo arquivo. É o certo: o dossiê é o
estado de hoje da fila, e o histórico está no git. **Com duas exceções: toda
rodada que reescreve o arquivo — `[D]` ou `[A]`, em qualquer ordem — lê antes o
que está lá e recopia:**

1. **A seção "Respondidas automaticamente nesta rodada", inteira**, somando as
   suas às que já estavam. É o único registro do que o `[A]` apurou, e a linha
   `decision:` que o CLI gravou no ledger aponta para ela; sobrescrever sem
   recopiar deixa o ledger apontando para um achado que não existe mais.
2. **Toda resposta que o operador preencheu**: cada linha `DW-<n> = <chave>` não
   vazia da folha, com o comentário dela, e cada slot `Resposta: DW-<n> = `
   preenchido dentro de um bloco. Enquanto não for commitado, este arquivo é o
   único lugar onde essas respostas existem — a noite que o operador passou lendo
   o dossiê cabe inteira nelas, e uma reescrita que as apaga é a perda mais cara
   que esta skill pode causar. Recopiar não depende de o id ainda estar na fila:
   uma resposta cujo id já saiu vem junto, marcada
   `# já saiu da fila — não envie`, porque o `[R]` cruza a folha com o
   `decisions --json` de agora de qualquer forma, e apagar a linha esconde do
   operador que a resposta dele chegou tarde.

As duas valem por condição, não por modo: se a seção existe, ela é recopiada; se
há resposta preenchida, ela é recopiada — não importa qual rodada escreveu o
arquivo nem qual está reescrevendo. E se o arquivo de hoje existe mas não abre,
**não sobrescreva**: diga o que houve e pare. Não existe "tinha pouca coisa ali".

## Como ele é lido, e o que isso obriga

Ninguém lê 93 decisões de cabo a rabo. O operador abre a seção do subsistema que
lhe interessa e responde as sete perguntas daquele portão de uma sentada.

Portanto: **cada seção se sustenta sozinha.** Repita o fato que aquela seção
precisa em vez de mandar o leitor a outra seção. Referência cruzada é barata para
quem escreve e cara para quem lê.

## Esqueleto do documento

```text
# Decisões de deferred work — <YYYY-MM-DD>

<resumo em três números>

## Contradições com decisões já respondidas
## Respondidas automaticamente nesta rodada        (se um [A] rodou hoje)
## <Subsistema>                                     (uma seção por subsistema)
### DW-<n> — <a decisão em uma frase>
## Folha de respostas                               (o que já estava preenchido volta preenchido)
```

Ordem fixa, e cada peça tem uma razão:

- **O resumo são três números** — quantas pendentes, quantas a skill responderia
  sozinha pelo `./judgment.md`, quantas carregam precedente contraditório. Mais a
  procedência: quando a fila foi lida, qual o ledger, quantas entradas abertas
  ele tem. O operador precisa saber se está olhando a fila de hoje.
- **As contradições lideram.** Resolver uma contradição costuma resolver várias
  decisões de uma vez, e responder as outras antes é responder na ordem errada.
- **As automáticas vêm antes do resíduo**, com a evidência de cada uma: o operador
  tem que poder discordar do que a skill tomou, e para isso precisa ver o que foi
  tomado sem caçar. A seção nasce num `[A]`, mas não é dele: uma vez escrita no dia,
  ela é recopiada por qualquer rodada seguinte, `[D]` inclusive — veja a regra de
  reescrita no topo.
- **O agrupamento é por subsistema**, derivado dos caminhos em `location:` e dos
  títulos das entradas — nunca pela numeração DW, que é ordem de chegada.
  Decisões vizinhas se contaminam: sete perguntas sobre o mesmo portão respondem
  melhor juntas, e separadas produzem respostas incoerentes entre si.
- **A folha de respostas é a última**, para o operador terminar de ler e escrever
  ali mesmo. Ela também é conteúdo humano no meio de um arquivo gerado: o que
  estiver preenchido nela sobrevive à próxima rodada do dia — veja a regra de
  reescrita no topo.

## O bloco de uma decisão

Seis partes. Cada uma tem uma regra, e a regra é o que separa um dossiê de uma
paráfrase.

### 1. A decisão em uma frase, em português simples

O título do bloco. Escreva para quem nunca leu esse código.

> **Regra:** se a sua frase é a pergunta do triage com sinônimos, apague e
> escreva de novo. Repetir o terse em outras palavras é exatamente o defeito que
> esta skill existe para consertar.

Teste: a frase nomeia **o que muda no sistema** conforme a resposta? Se ela só
nomeia um conceito ("allowlist para tabela preexistente"), ainda não é uma frase.

### 2. O que o código faz hoje

O trecho em `location:`, **lido do arquivo como ele está agora** — nunca de
memória, nunca da paráfrase da entrada. Com `caminho:linha` acima, e linhas
suficientes em volta para o trecho fazer sentido sozinho (dez a vinte e cinco;
mais que isso é dump).

Se o caminho não existe mais, diga isso aqui e cite o commit que o removeu ou
renomeou (`git log --diff-filter=D -- <caminho>`, e `--follow` antes de concluir
remoção). A ausência é informação: quase sempre a decisão já está morta.

### 3. Por que é assim

O parágrafo de doutrina, **citado verbatim**, com arquivo, seção e data. Não a
sua síntese dele.

Se nenhum documento diz, escreva **"nenhum documento diz"**. É a linha mais útil
do bloco: rigor que ninguém escreveu costuma ser rigor incidental, e saber disso
muda a resposta.

### 4. As opções, por consequência e custo

Uma tabela. O rótulo de duas palavras entra entre parênteses, nunca sozinho:

| #   | Efeito      | O que passa a acontecer | O que custa       | O que se perde |
| --- | ----------- | ----------------------- | ----------------- | -------------- |
| 1   | `keep-open` | …                       | …                 | …              |
| 2   | `build`     | …                       | uma sessão de dev | …              |

O efeito (`build` / `close` / `keep-open`) fica visível porque é ele que decide o
que acontece mecanicamente depois: `build` vira bundle no próximo sweep, `close`
mata a entrada agora, `keep-open` devolve a pergunta ao próximo triage.

A coluna "o que se perde" é obrigatória e é a que costuma faltar. Toda opção
perde alguma coisa; a que parece não perder nada é a que não foi analisada.

### 5. Recomendação, e o que a mudaria

Uma opção, o motivo em uma ou duas frases, e — a parte que ninguém escreve — **o
fato que viraria a recomendação**:

> Recomendo a 2. … Vira a 1 se o prazo do portão de conformidade for antes de
> outubro: aí a allowlist é dívida com data e a exceção sai mais cara que o
> conserto.

A condição de virada é o que deixa o operador discordar **rápido**, sem reler o
bloco inteiro. Ele sabe coisas que você não sabe; dê a ele o gatilho.

Se a recomendação do triage (`recommendation` no `--json`) for outra, diga isso e
por quê. Duas recomendações em conflito, escondidas, são pior que uma discordância
declarada.

### 6. A resposta

    Resposta: DW-<n> = ____

## A folha de respostas

O acelerador do `[R]`. Uma linha por decisão, id e chave — e só:

```
## Folha de respostas

Escreva a chave da opção depois do `=`. Deixe em branco o que quiser conversar.

    DW-173 = 2      # allowlist com prazo
    DW-181 =        # quero discutir
    DW-190 = 1
```

Gramática: `DW-<n>` `=` `<chave>`, com `#` abrindo comentário livre até o fim da
linha. Em branco significa **"pergunte"**, nunca "pule".

**A folha atravessa a reescrita.** O operador preenche ao longo do dia e pede
outra rodada (`[D]` de novo, ou `[A]` sobre o resíduo) sem pensar no arquivo; quem
reescreve é quem tem de lembrar. Toda linha preenchida do dossiê de hoje volta
preenchida, com o comentário — a regra está no topo deste arquivo, e ela não é
negociável porque o git só protege o que já foi commitado.

A chave é a `key` que o `decisions --json` deu àquela opção — não a posição na
sua tabela. As duas coincidem quase sempre, e "quase sempre" é como se grava a
resposta errada.

O CLI nunca aprende este formato: o `[R]` traduz a folha para
`--answer DW-173=2 --answer DW-190=1`. É o que deixa os dois lados mudarem sem
combinar.

## Um bloco preenchido, como referência

O exemplo é a decisão real que motivou esta skill. Compare o que o prompt
mostrava — `"O portão de conformidade deve ganhar allowlist para tabela
preexistente fora dos sete schemas?" [1/2/3]` — com o bloco abaixo.

```markdown
### DW-173 — Uma tabela que já existia antes do portão fica bloqueada para sempre, ou ganha exceção com prazo?

**Hoje:** `src/compliance/gate.py:88`

    SCHEMAS = ("core", "billing", "identity", "audit",
               "telemetry", "staging", "archive")

    def check(table: str) -> None:
        if table.split(".")[0] not in SCHEMAS:
            raise ComplianceError(f"{table} fora dos schemas cobertos")

O portão recusa qualquer tabela fora desses sete schemas. A tabela
`legacy.pagamentos_2019` é anterior ao portão, ainda é lida por dois relatórios,
e não está em nenhum deles — então esses relatórios falham desde 2026-07-30.

**Por que é assim:** `_bmad-output/doutrina/conformidade.md`, §4 (2026-05-02):

> A cobertura é por schema, e a lista é fechada. Uma exceção por tabela devolve
> ao portão a decisão que ele existe para tirar de quem escreve a query.

A recusa fechada é deliberada, e é anterior à descoberta da tabela legada.

| #   | Efeito      | O que passa a acontecer                                               | O que custa                                    | O que se perde                                |
| --- | ----------- | --------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| 1   | `build`     | allowlist com data de expiração e um teste que falha quando ela vence | uma sessão de dev                              | a lista fechada do §4 deixa de ser fechada    |
| 2   | `build`     | migrar `legacy.pagamentos_2019` para o schema `archive`               | uma sessão de dev, mais uma janela de migração | os dois relatórios param até a migração rodar |
| 3   | `keep-open` | nada muda; os relatórios seguem falhando                              | nada agora                                     | mais um ciclo com dois relatórios quebrados   |

**Recomendo a 2.** Ela é a única que não abre exceção no portão, e o §4 diz
que a exceção é o que se estava evitando. Vira a 1 se a janela de migração não
couber antes do fechamento do trimestre — aí a allowlist com prazo é dívida
declarada, que é melhor que relatório quebrado em silêncio. O triage recomendava
a 1; ele não tinha lido o §4.

`Resposta: DW-173 = ____`
```

Vinte e poucas linhas. O prompt tinha uma.

## Orçamento

Um bloco que passa de ~40 linhas quase sempre é uma de duas coisas: duas decisões
enfiadas numa, ou um trecho de código que precisa ser cortado. Corte o código
primeiro — o leitor precisa do que decide, não do arquivo.
