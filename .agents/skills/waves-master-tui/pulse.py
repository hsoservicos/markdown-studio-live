#!/usr/bin/env python3
"""Batimento DETERMINÍSTICO de um run iniciado com `llm-run`: um veredito
estruturado sobre o supervisor e o protocolo de turno.

    python3 pulse.py --project <raiz> [--json] [--run <ref>]

Este script não mede a QUALIDADE das decisões do orquestrador — isso não é
mecânico e não deve fingir que é. Ele mede o que é: o supervisor está vivo? os
turnos estão escrevendo alguma coisa? a cota de relançamento está acabando? o
run pausou e ninguém sabe? alguma story ficou parada em fase sem saída? uma
sessão despachada está muda? o quadro diz `done` sobre trabalho que o branch de
integração não contém? e — a pergunta que faltava — o run acabou SEM concluir?

Os achados são de duas famílias, e a diferença governa o que o estado terminal
pode calar. Achado de PROCESSO (supervisor morto, turno silencioso, sessão muda)
só faz sentido enquanto há processo, e um run terminal o suprime. Achado de
CONCLUSÃO (`encerrado-sem-concluir`, `quadro-diverge-do-git`) é o contrário: ele
existe para o depois, e calá-lo faz um run que morreu no meio de uma story — ou
um quadro que mente sobre o que entrou — ler igual a um run saudável, que é o
pior modo de falha possível num alarme.

Não escreve nada em lugar nenhum, por design. Num run por LLM toda mutação
pertence aos verbos `unit`, que o orquestrador chama sob o lock do diretório do
run; um monitor que escrevesse por fora faria o próximo turno decidir sobre um
estado que não é o que ele leu.

Saída: JSON com --json, texto legível caso contrário.
Exit: 0 ok · 1 vigiar · 2 agir · 3 crítico · 4 não deu pra medir.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    tomllib = None  # type: ignore[assignment]

RULES_PATH = Path(__file__).with_name("rules.toml")

SEVERIDADES = {"ok": 0, "watch": 1, "act": 2, "critical": 3}

# Kinds que o supervisor e os verbos escrevem só para marcar o andamento do
# protocolo. Um turno cujo journal tem apenas isto não moveu trabalho nenhum.
#
# `baton` entra aqui de propósito. O orquestrador o escreve ao receber o turno de
# volta de uma sessão que fechou, e ele existe para dar rastro à janela de leitura
# que antecede a decisão — janela cara e, até então, muda. Mas receber o bastão
# não é mover trabalho: quem move é `decision`, `llm-phase`, `story-done`. Contá-lo
# como trabalho faria um turno que abre, avisa que assumiu e trava parecer
# produtivo — cegando `turnos-sem-avanco` exatamente no caso que ela existe para
# pegar. No `silencio_do_turno` ele CONTA, e deve: ali é prova honesta de que o
# turno estava vivo naquele instante, e o protocolo proíbe repeti-lo enquanto lê.
KINDS_PROTOCOLO = {"turn-start", "turn-end", "session-start", "run-start", "run-stop", "baton"}

_PADROES = {
    "max_relancamentos": 20,
    "alerta_em_fracao_da_cota": 0.5,
    "folga_sobre_o_teto_min": 15,
    "silencio_maximo_min": 20,
    "turnos_sem_avanco": 3,
    "tolerancia_pid_s": 20,
    "sessao_muda_min": 10,
}

# Fase em que o orquestrador não vai mais dirigir a story NESTE run. Espelha
# `model.TERMINAL_PHASES`; a cópia é deliberada, como a dos limiares — o monitor
# precisa de uma resposta mesmo sem conseguir importar o pacote.
FASES_TERMINAIS = frozenset({"done", "deferred", "escalated", "awaiting-operator"})

# Terminal, e sem entrega: ninguém retoma, e não há commit. Um run que segue em
# andamento com uma destas no quadro tem trabalho abandonado que só um humano
# reabre.
FASES_SEM_ENTREGA = frozenset({"deferred", "escalated"})


def carregar_limiares() -> tuple[dict, list[str]]:
    """(limiares, avisos) — nunca levanta. Configuração quebrada deixa o run
    sem vigia se derrubar o vigia, então ela vira aviso e o padrão assume."""
    if tomllib is None:
        return dict(_PADROES), ["python sem tomllib; usando limiares padrão"]
    try:
        dados = tomllib.loads(RULES_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return dict(_PADROES), [f"rules.toml ausente em {RULES_PATH}; usando padrões"]
    except (OSError, ValueError) as e:
        return dict(_PADROES), [f"rules.toml ilegível ({e}); usando padrões"]

    limiares, avisos = dict(_PADROES), []
    # Under `[llm.limiares]`: this file shares rules.toml with heartbeat.py, whose
    # `[limiares]` are other numbers with other meanings.
    for chave, valor in ((dados.get("llm") or {}).get("limiares") or {}).items():
        if chave not in _PADROES:
            avisos.append(f"rules.toml: limiar desconhecido ignorado: {chave}")
        elif not isinstance(valor, (int, float)) or isinstance(valor, bool) or valor <= 0:
            avisos.append(f"rules.toml: limiar inválido ignorado: {chave}={valor!r}")
        else:
            limiares[chave] = valor
    return limiares, avisos


def _run(argv: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Subprocesso com argv em LISTA, nunca string de shell."""
    try:
        p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.SubprocessError) as e:
        return 127, "", str(e)


def ha_runs(project: Path) -> bool:
    """Existe algum run neste projeto?

    Perguntado à parte porque "não há run" e "não consegui medir" são coisas
    diferentes que a mesma saída vazia produz. Tratar as duas como falha faz um
    projeto onde ninguém lançou nada ainda parecer um sistema quebrado — e
    `critical` gasto assim treina quem lê a ignorar o `critical` que importa.
    """
    rc, out, _ = _run(["waves", "list", "--project", str(project), "--json"])
    if rc != 0 or not out.strip():
        return False
    try:
        doc = json.loads(out)
    except json.JSONDecodeError:
        return False
    runs = doc.get("runs")
    return bool(runs) if isinstance(runs, list) else False


def ler_status(project: Path, ref: str | None) -> dict | None:
    """O contrato `--json` do CLI, que é versionado — preferido a qualquer
    leitura de arquivo interno."""
    argv = ["waves", "status", "--project", str(project), "--json"]
    if ref:
        argv.append(ref)
    rc, out, _ = _run(argv)
    if rc != 0 or not out.strip():
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def pid_vivo(run_dir: Path) -> tuple[int | None, bool]:
    """(pid, vivo). O arquivo traz `"<pid>"` ou `"<pid> <identidade>"`; a
    identidade existe para distinguir o processo original de um estranho que
    herdou o pid reciclado, e aqui só o primeiro campo é necessário."""
    arquivo = run_dir / "engine.pid"
    try:
        bruto = arquivo.read_text(encoding="utf-8").split()
    except OSError:
        return None, False
    if not bruto:
        return None, False
    try:
        pid = int(bruto[0])
    except ValueError:
        return None, False
    try:
        os.kill(pid, 0)
        return pid, True
    except ProcessLookupError:
        return pid, False
    except PermissionError:
        # Existe e é de outro dono: vivo para o que interessa aqui.
        return pid, True
    except OSError:
        return pid, False


def batida(task_dir: Path) -> dict | None:
    """A última prova de vida do laço de espera, ou None.

    Ela carrega `remaining_s`, a conta regressiva do teto de sessão que o
    adapter aplica — a autoridade sobre quanto tempo ainda resta, sem esta skill
    precisar saber (nem espelhar) o `session_timeout_min` do projeto.
    """
    try:
        payload = json.loads((task_dir / "heartbeat.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def sessoes_despachadas(journal: list[dict]) -> list[dict]:
    """As sessões que o orquestrador despachou e que ainda não assentaram.

    Pareia `session-start` com `session-end` por `task_id`: o watcher escreve o
    `session-end` de TODA sessão que termina, inclusive a que morreu, então o que
    fica sem par é o que ainda está sendo esperado.

    A sessão orquestradora fica de fora de propósito. Ela é medida pelo turno, em
    `silencio_do_turno`, e o buraco que este cruzamento existe para tapar é nas
    DESPACHADAS — não confundir os dois é metade do valor da medida.
    """
    abertas: dict[str, dict] = {}
    for e in journal:
        task_id = e.get("task_id")
        if not isinstance(task_id, str) or not task_id:
            continue
        kind = e.get("kind")
        if kind == "session-start":
            if e.get("role") == "orchestrator":
                continue
            abertas[task_id] = {
                "task_id": task_id,
                "role": e.get("role"),
                "story_key": e.get("story_key"),
                "inicio": e.get("ts"),
            }
        elif kind == "session-end":
            abertas.pop(task_id, None)
    return list(abertas.values())


def idade_min(caminho: Path, agora: float) -> float | None:
    """Minutos desde a última escrita no arquivo, ou None se ele não existe."""
    try:
        return max(0.0, (agora - caminho.stat().st_mtime) / 60.0)
    except OSError:
        return None


def arvore_suja(arvore: Path) -> bool | None:
    """A árvore tem escrita não commitada? None quando não dá para medir.

    `--porcelain` conta o não rastreado de propósito: a pergunta aqui não é o que
    o git vai commitar, é se a sessão escreveu ALGUMA coisa. Arquivo novo conta.

    None (worktree já desmontada pelo merge, git indisponível, caminho que não é
    repositório) tem que continuar significando "não medi", nunca "está limpa":
    é a única direção em que errar não inventa um alarme.
    """
    rc, out, _ = _run(["git", "-C", str(arvore), "status", "--porcelain"], timeout=20)
    if rc != 0:
        return None
    return bool(out.strip())


def contido_no_alvo(project: Path, ref: str, alvo: str) -> bool | None:
    """O `ref` já está contido no branch de integração? None quando não dá para medir.

    É a checagem do invariante quadro↔git, e ela é uma pergunta ao git e nada
    mais: `merge-base --is-ancestor` sai 0 para contido, 1 para não contido, e
    qualquer outra coisa (ref que não resolve, diretório que não é repositório,
    git ausente) é falta de medida — nunca "não contido". Um branch já apagado
    depois do merge é justamente esse caso, e lê-lo como divergência inventaria o
    alarme sobre a limpeza normal da ferramenta.
    """
    if not ref or not alvo:
        return None
    rc, _, _ = _run(
        ["git", "-C", str(project), "merge-base", "--is-ancestor", ref, alvo], timeout=20
    )
    if rc == 0:
        return True
    if rc == 1:
        return False
    return None


def head_do_projeto(project: Path) -> dict | None:
    """`{"sha": ..., "branch": ...}` do checkout COMPARTILHADO, ou None.

    `branch` vem vazio num HEAD destacado, que é informação e não erro. Isto aqui
    é um fato, não um achado: o script é sem memória por design, e comparar dois
    ticks é do agente (regra `head-compartilhado-mexeu`).
    """
    rc, sha, _ = _run(["git", "-C", str(project), "rev-parse", "--short", "HEAD"], timeout=20)
    if rc != 0 or not sha.strip():
        return None
    rc_b, nome, _ = _run(
        ["git", "-C", str(project), "rev-parse", "--abbrev-ref", "HEAD"], timeout=20
    )
    branch = nome.strip() if rc_b == 0 else ""
    return {"sha": sha.strip(), "branch": "" if branch == "HEAD" else branch}


def silencio_do_turno(
    run_dir: Path, journal: list[dict], orquestradora: str | None, agora: float
) -> float | None:
    """Minutos desde a última coisa que o turno escreveu, ou None se não dá para medir.

    Duas fontes, e vale a mais recente das duas: a última entrada do journal (o
    orquestrador registra decisão e resumo de turno) e o mtime do log de painel
    da sessão dele. Uma sozinha mente em direções opostas — um turno pode passar
    muito tempo dentro de uma sessão worker sem escrever no journal, e o log
    cresce com redraw sem que nada seja decidido.

    None quando nenhuma das duas existe: sem base de comparação, o certo é não
    reportar nada em vez de chamar de silêncio o que é falta de medida.
    """
    marcos: list[float] = []
    for entrada in reversed(journal):
        # `operator` é escrito por `intervene` — pelo humano, ou pelo vigia. Não é
        # prova de que o turno andou; é prova de que alguém está tentando chamar a
        # atenção dele. Contá-la inverte o sinal: quanto mais se cutuca um
        # orquestrador ocioso, mais saudável o run parece, até o silêncio medido
        # ser o intervalo entre duas falas em vez da idade real da parada.
        #
        # `turn-start` fica de fora desta exclusão de propósito: ele é a ÂNCORA a
        # partir da qual o silêncio se mede, e um turno que começou e nunca escreveu
        # nada precisa medir desde o começo dele.
        if entrada.get("kind") == "operator":
            continue
        ts = entrada.get("ts")
        if isinstance(ts, (int, float)):
            marcos.append(float(ts))
            break
    if orquestradora:
        log = run_dir / "logs" / f"{orquestradora}.log"
        try:
            marcos.append(log.stat().st_mtime)
        except OSError:
            pass
    if not marcos:
        return None
    return max(0.0, (agora - max(marcos)) / 60.0)


def ler_journal(run_dir: Path) -> list[dict]:
    linhas: list[dict] = []
    try:
        with (run_dir / "journal.jsonl").open(encoding="utf-8") as f:
            for linha in f:
                linha = linha.strip()
                if not linha:
                    continue
                try:
                    d = json.loads(linha)
                except json.JSONDecodeError:
                    continue
                if isinstance(d, dict):
                    linhas.append(d)
    except OSError:
        return []
    return linhas


def turnos(journal: list[dict]) -> list[dict]:
    """Um registro por turno: início, fim, veredito e se houve trabalho.

    Trabalho é qualquer evento fora de KINDS_PROTOCOLO entre o início e o fim —
    é a mesma pergunta que o supervisor faz para classificar o turno, feita
    sobre o que ficou escrito."""
    resultado: list[dict] = []
    atual: dict | None = None
    for entrada in journal:
        kind = entrada.get("kind")
        if kind == "turn-start":
            atual = {
                "inicio": entrada.get("ts"),
                "fim": None,
                "veredito": None,
                "trabalho": False,
            }
            resultado.append(atual)
        elif atual is not None and kind == "turn-end":
            atual["fim"] = entrada.get("ts")
            atual["veredito"] = entrada.get("verdict")
            atual = None
        elif atual is not None and kind not in KINDS_PROTOCOLO:
            atual["trabalho"] = True
    return resultado


def violacoes_seguidas(lista: list[dict]) -> int:
    """Violações consecutivas no fim da série — a mesma contagem que gasta cota.
    Turno produtivo zera, então contar do fim para trás é o que espelha o
    supervisor; contar o total mentiria para cima."""
    n = 0
    for t in reversed(lista):
        if t.get("veredito") == "violation":
            n += 1
        elif t.get("veredito") is None:
            continue  # turno ainda aberto não decidiu nada
        else:
            break
    return n


def sem_avanco_seguidos(lista: list[dict]) -> int:
    n = 0
    for t in reversed(lista):
        if t.get("fim") is None:
            continue
        if t.get("trabalho"):
            break
        n += 1
    return n


class Relatorio:
    def __init__(self) -> None:
        self.fatos: dict = {}
        self.findings: list[dict] = []

    def add(self, code: str, sev: str, detalhe: str, acao: str = "") -> None:
        self.findings.append({"code": code, "severity": sev, "detail": detalhe, "acao": acao})

    @property
    def severidade(self) -> str:
        if not self.findings:
            return "ok"
        return max((f["severity"] for f in self.findings), key=lambda s: SEVERIDADES[s])


def diagnosticar(project: Path, ref: str | None, lim: dict) -> tuple[Relatorio, str]:
    r = Relatorio()
    status = ler_status(project, ref)
    if status is None:
        if not ha_runs(project):
            # Não é diagnóstico: é um projeto onde ninguém lançou nada. `ok`,
            # porque não há nada errado com um projeto vazio, e a resposta certa
            # é uma linha oferecendo o start — não um relatório.
            r.add(
                "sem-run",
                "ok",
                f"nenhum run em {project} — não há o que monitorar",
                "menu [S]: lance um `llm-run` neste projeto",
            )
            return r, "sem-run"
        r.add(
            "sem-medicao",
            "critical",
            "há runs, mas `status --json` não respondeu — confira `--project` e o ref",
            "leia `waves list --project <raiz>`",
        )
        return r, "unknown"

    run_id = status.get("run_id") or status.get("id") or "?"
    run_dir = project / ".waves/loop" / "runs" / str(run_id)
    estado = str(status.get("state") or status.get("status") or "unknown")
    r.fatos["run_id"] = run_id
    r.fatos["state"] = estado
    r.fatos["source"] = status.get("source")

    if status.get("source") not in (None, "llm"):
        r.add(
            "run-nao-e-llm",
            "watch",
            f"este run foi iniciado como `{status.get('source')}`, não por `llm-run`",
            "use a skill waves-master-tui",
        )

    # `stopped` significa que o PROCESSO saiu, não que o run acabou — e uma
    # pausa encerra o processo de propósito. Ler `stopped` como terminal engole
    # exatamente o achado que este monitor existe para dar: o run pausado que
    # ninguém viu. Por isso a pausa é decidida primeiro e vence.
    pausado = bool(status.get("paused_reason"))
    encerrado = bool(status.get("finished") or status.get("crashed") or status.get("stopped"))
    # `stopped` só fica `true` depois de um `stop` EXPLÍCITO, então pausado E
    # encerrado é um terceiro estado, reconhecível e distinto da pausa órfã:
    # alguém já veio, viu a pausa e fechou o run. Sem separá-lo o monitor dispara
    # `run-pausado` para sempre sobre trabalho já encerrado — ruído que ensina o
    # operador a ignorar o alarme.
    pausa_encerrada = pausado and bool(status.get("stopped"))
    terminal = encerrado and not pausado
    r.fatos["pausado"] = pausado
    r.fatos["encerrado"] = encerrado
    r.fatos["terminal"] = terminal
    journal = ler_journal(run_dir)
    lista = turnos(journal)
    r.fatos["turnos"] = len(lista)

    # As fases das tasks já vinham no `status --json` e o pulse as descartava, de
    # modo que nenhum campo aqui enxergava `escalated`. Uma story escalada podia
    # ficar horas parada com o veredito respondendo `ok` — medido em 2026-08-18,
    # quatro horas até o próprio orquestrador reclamar.
    tarefas = [t for t in (status.get("tasks") or []) if isinstance(t, dict)]
    fases = {
        str(t["story_key"]): str(t.get("phase")) for t in tarefas if t.get("story_key") is not None
    }
    r.fatos["fases"] = fases

    pid, vivo = pid_vivo(run_dir)
    r.fatos["pid"] = pid
    r.fatos["supervisor_vivo"] = vivo

    agora = time.time()
    aberto = lista[-1] if lista and lista[-1].get("fim") is None else None

    # Run pausado não tem supervisor por construção: a pausa encerra o processo.
    # Cobrar pid vivo ali é o falso "morto" clássico — o achado certo para a
    # pausa é `run-pausado`, logo abaixo.
    if not terminal and not pausado and not vivo:
        idade = None
        if aberto and isinstance(aberto.get("inicio"), (int, float)):
            idade = agora - float(aberto["inicio"])
        if idade is None or idade > float(lim["tolerancia_pid_s"]):
            r.add(
                "supervisor-morto",
                "critical",
                f"estado `{estado}` e nenhum processo vivo no pid {pid}",
                "regra supervisor-morto: leia o último turno, então `stop` e relance `llm-run`",
            )

    if pausa_encerrada:
        r.add(
            "pausa-encerrada",
            "watch",
            f"pausado e já encerrado por um `stop`: {status.get('paused_reason')}",
            "regra pausa-encerrada: arquive o run; não há o que retomar",
        )
    elif pausado:
        r.add(
            "run-pausado",
            "act",
            f"pausado: {status.get('paused_reason')}",
            "regra run-pausado",
        )

    # Fase terminal SEM entrega com o run ainda correndo: ninguém a retoma neste
    # run, não há commit, e nada no relatório dizia isso antes.
    if not encerrado:
        paradas = sorted(k for k, f in fases.items() if f in FASES_SEM_ENTREGA)
        if paradas:
            r.add(
                "story-parada",
                "act",
                "com o run em andamento: " + ", ".join(f"{k} em `{fases[k]}`" for k in paradas),
                "regra story-parada",
            )

    # INVARIANTE QUADRO↔GIT, e é o achado que faltava no incidente inteiro.
    #
    # Já houve quadro marcando duas stories consecutivas como `done` enquanto o
    # branch de integração não continha nenhuma das duas: o guard de colisão recusava os merges, o quadro
    # registrava aprovação nos portões como entrega, e nada cruzava as duas
    # fontes. Quatro horas de `severity: ok` sobre duas stories provadas fora do
    # branch de integração. A checagem custa um `merge-base --is-ancestor` por
    # story `done` e dispara no minuto do primeiro merge recusado.
    #
    # Achado de CONCLUSÃO, como `encerrado-sem-concluir`, e por isso NÃO é calado
    # por estado terminal: um quadro que mente sobre entrega mente mais depois do
    # run acabar, não menos — é o que o próximo run vai ler para escolher escopo.
    #
    # O laço lê a FASE DA TAREFA, nunca a linha do quadro, e isso carrega peso
    # apesar do nome do achado sugerir o contrário. `close` põe a tarefa em `done`
    # ANTES de tentar a integração, então um merge recusado deixa fase `done` com
    # o commit fora do branch alvo — e o achado fala qualquer que seja o texto no
    # quadro. É por isso que ensinar o quadro a dizer `awaiting-merge` em vez de
    # mentir não cega o alarme. Quem reescrever isto para ler o status do quadro
    # reintroduz o silêncio: quadro honesto e ninguém olhando. Preso por
    # `tests/test_llm_pulse.py::test_quadro_diverge_fires_with_the_board_at_awaiting_merge`.
    #
    # Só sob isolamento por worktree: sem `target_branch` não há alvo separado
    # onde o commit pudesse faltar, e no modo in-place o commit nasce no próprio
    # checkout. `commit_sha` é preferido ao branch porque sobrevive ao branch
    # apagado no teardown; o branch é a reserva de quem ainda não commitou.
    alvo = str(status.get("target_branch") or "")
    r.fatos["branch_alvo"] = alvo or None
    contencao: dict[str, bool | None] = {}
    if alvo:
        for t in tarefas:
            if str(t.get("phase")) != "done" or t.get("story_key") is None:
                continue
            ref = str(t.get("commit_sha") or "") or str(t.get("branch") or "")
            contencao[str(t["story_key"])] = contido_no_alvo(project, ref, alvo)
    r.fatos["quadro_git"] = contencao
    # `is False` e não `not ...`: None é "não medi" — branch já apagado, git
    # indisponível — e tratá-lo como divergência inventaria o alarme sobre a
    # ausência da medida.
    fora = sorted(k for k, dentro in contencao.items() if dentro is False)
    if fora:
        r.add(
            "quadro-diverge-do-git",
            "act",
            f"o quadro diz `done` e `{alvo}` não contém: " + ", ".join(fora),
            "regra quadro-diverge-do-git",
        )

    seguidas = violacoes_seguidas(lista)
    r.fatos["violacoes_seguidas"] = seguidas
    cota = float(lim["max_relancamentos"])
    if seguidas and seguidas >= cota * float(lim["alerta_em_fracao_da_cota"]):
        r.add(
            "violacoes-acumulando",
            "act",
            f"{seguidas} turnos seguidos sem escrever nada, de uma cota de {int(cota)}",
            "regra violacoes-acumulando: leia o log do orquestrador",
        )

    # A sessão orquestradora CORRENTE, pelo papel que o supervisor grava no
    # session-start — é dela que sai a batida com a conta regressiva do teto.
    #
    # A MAIS RECENTE, não a primeira. O supervisor abre uma sessão orquestradora
    # nova a cada relançamento de turno e todas ficam no journal, então `next()`
    # sobre a ordem cronológica devolvia a do primeiro turno — que num run longo é
    # um cadáver. Medido 2026-08-22, run `20260822-095341-34b9`: `orchestrator-1`
    # morto às 14:10 numa tela de autenticação, `orchestrator-3` escrevendo no
    # segundo corrente. Três leituras saíam do arquivo errado, e a terceira é a
    # cara: o `turno_task` reportado (que manda o humano falar com a sessão
    # errada), a batida lida de `tasks/<id>` (por isso `turno_restante_s`
    # congelava num valor fixo) e o mtime de log em `silencio_do_turno` — que num
    # arquivo morto nunca mais cresce, então o silêncio medido sobe sem teto e
    # `turno-silencioso` vira alarme permanente do segundo turno em diante.
    # Perder essa medida é perder a única coisa que separa turno parado de turno
    # trabalhando, que é exatamente o que o achado existe para dizer.
    orquestradora = next(
        (
            str(e.get("task_id"))
            for e in reversed(journal)
            if e.get("kind") == "session-start" and e.get("role") == "orchestrator"
        ),
        None,
    )
    r.fatos["turno_task"] = orquestradora

    # Só se o run estiver de fato correndo. Um run pausado ou terminado deixa
    # o último `turn-start` sem par — o supervisor sai antes de fechá-lo — então
    # um turno "aberto" ali é resíduo, não turno vivo, e cobrar silêncio dele
    # reporta como doença o fim normal do expediente. Mesma armadilha que
    # `supervisor-morto` já evita, pelo mesmo motivo.
    if not pausado and not terminal and aberto and isinstance(aberto.get("inicio"), (int, float)):
        vivo_min = (agora - float(aberto["inicio"])) / 60.0
        r.fatos["turno_aberto_min"] = round(vivo_min, 1)
        # NÃO se mede o turno contra um número escrito aqui. Um turno é longo por
        # design — atravessa uma story inteira — e o único teto que existe é o
        # `limits.session_timeout_min` do PROJETO, que cada repositório ajusta.
        # Espelhar esse valor nas regras produz exatamente o alarme falso que
        # este comentário existe para impedir: um projeto com teto de 3h
        # disparando contra um espelho de 90 min, em toda story.
        #
        # A batida do próprio laço de espera já carrega a conta regressiva. Ela é
        # a autoridade: `remaining_s` no negativo com a sessão ainda sendo
        # esperada significa que o timeout não disparou — que é a única coisa
        # aqui que é anomalia de verdade.
        beat = batida(run_dir / "tasks" / orquestradora) if orquestradora else None
        restante = None
        if isinstance(beat, dict):
            try:
                restante = float(beat["remaining_s"])
            except (KeyError, TypeError, ValueError):
                restante = None
        r.fatos["turno_restante_s"] = restante

        # DURAÇÃO NÃO É SINTOMA. Um turno saudável atravessa story após story —
        # no laço por LLM o turno 1 pode não fechar durante o épico inteiro —
        # então qualquer limiar de tempo aberto só adia o falso positivo até o
        # número seguinte. O sintoma é SILÊNCIO: um turno que não escreve nada
        # está parado, tenha ele dez minutos ou dez horas.
        silencio_min = silencio_do_turno(run_dir, journal, orquestradora, agora)
        r.fatos["turno_silencio_min"] = round(silencio_min, 1) if silencio_min is not None else None
        limite_silencio = float(lim["silencio_maximo_min"])
        if silencio_min is not None and silencio_min > limite_silencio:
            r.add(
                "turno-silencioso",
                "act",
                f"turno aberto há {vivo_min:.0f} min e sem escrever nada há "
                f"{silencio_min:.0f} min (limite {limite_silencio:.0f})",
                "regra turno-silencioso: leia o log do orquestrador antes de parar nada",
            )

        # O teto de sessão passado é outra coisa, e mais fraca: prova que o
        # timeout do adapter não disparou, não que o turno esteja doente. Fica em
        # `watch` e nunca sozinho justifica parar — com trabalho acontecendo, o
        # defeito é do mecanismo, e o trabalho não tem culpa.
        folga_s = float(lim["folga_sobre_o_teto_min"]) * 60.0
        if restante is not None and restante < -folga_s:
            r.add(
                "teto-nao-disparou",
                "watch",
                f"o teto da sessão passou há {abs(restante) / 60:.0f} min e ela segue esperada",
                "regra teto-nao-disparou: é o mecanismo de timeout, não o turno",
            )

    # BATIDA NÃO É PROGRESSO — e este é o cruzamento que faltava.
    #
    # `heartbeat.json` é escrito pelo LAÇO DE ESPERA do adapter, não pela sessão
    # que trabalha (src/riaworks_waves_loop/llm/watch.py:5). Ela prova que o esperador está
    # esperando, e uma sessão congelada num prompt de erro a mantém perfeitamente
    # fresca para sempre. Medido: uma sessão de dev morreu num `API Error: 500`
    # depois de menos de dois minutos; doze minutos mais tarde o log
    # estava no mesmo mtime, a worktree limpa — e a batida marcava SEIS SEGUNDOS
    # de frescor. Um leitor humano olhou a batida e declarou a sessão viva.
    #
    # Corolário, e ele é do mecanismo, não deste script: a condição
    # `stale-heartbeat` do adapter (llm/watch.py:28) NÃO PODE pegar sessão
    # travada, porque o que congela (a sessão) não é o que escreve (o laço de
    # espera). Ela pega o esperador morrendo, que é outra coisa. Apertar o limiar
    # dela não ajuda e nunca vai ajudar.
    #
    # O que prova trabalho são dois sinais, e nenhum deles é a batida: o log da
    # sessão crescendo, e a árvore em que ela foi despachada sujando. Silêncio nos
    # dois é sessão muda — com batida fresca ou sem.
    arvores = {
        str(t["story_key"]): str(t.get("worktree_path") or "")
        for t in tarefas
        if t.get("story_key") is not None
    }
    sessoes: list[dict] = []
    # Achado de PROCESSO: só faz sentido com processo vivo. Um run terminal ou
    # pausado não tem quem colha sessão nenhuma, e cobrar silêncio delas ali
    # reporta como doença o fim normal do expediente.
    if not terminal and not pausado:
        limite_muda = float(lim["sessao_muda_min"])
        for sessao in sessoes_despachadas(journal):
            task_id = str(sessao["task_id"])
            story_key = str(sessao.get("story_key") or "")
            log_min = idade_min(run_dir / "logs" / f"{task_id}.log", agora)
            beat = batida(run_dir / "tasks" / task_id)
            beat_s = None
            if isinstance(beat, dict):
                try:
                    beat_s = max(0.0, agora - float(beat["ts"]))
                except (KeyError, TypeError, ValueError):
                    beat_s = None
            # A árvore em que a sessão foi de fato despachada: a worktree da story
            # sob isolamento, o checkout do projeto sem ele — que é exatamente a
            # regra de `cwd` do `unit dispatch`.
            arvore = Path(arvores.get(story_key) or project)
            suja = arvore_suja(arvore)
            sessoes.append(
                {
                    "task_id": task_id,
                    "role": sessao.get("role"),
                    "story_key": sessao.get("story_key"),
                    "log_silencio_min": round(log_min, 1) if log_min is not None else None,
                    "batida_s": round(beat_s, 1) if beat_s is not None else None,
                    "arvore": str(arvore),
                    "arvore_suja": suja,
                }
            )
            # `suja is False` e não `not suja`: None é "não medi" — worktree já
            # desmontada pelo merge, git indisponível — e tratar isso como limpa
            # inventaria o alarme em cima da própria falta de medida.
            if log_min is not None and log_min > limite_muda and suja is False:
                frescor = (
                    f" — e a batida marca {beat_s:.0f}s de frescor, que é o laço de"
                    " espera, não a sessão"
                    if beat_s is not None
                    else ""
                )
                r.add(
                    "sessao-muda",
                    "act",
                    f"sessão {sessao.get('role')} da story {sessao.get('story_key')} "
                    f"({task_id}): log parado há {log_min:.0f} min "
                    f"(limite {limite_muda:.0f}) e nada escrito em {arvore}{frescor}",
                    "regra sessao-muda",
                )
    r.fatos["sessoes"] = sessoes

    parados = sem_avanco_seguidos(lista)
    r.fatos["turnos_sem_avanco"] = parados
    if not terminal and parados >= int(lim["turnos_sem_avanco"]):
        r.add(
            "giro-sem-avanco",
            "watch",
            f"{parados} turnos fechados sem nenhum evento de trabalho",
            "regra giro-sem-avanco",
        )

    # UM ALERTA PRECISA DE IDENTIDADE. Sem impressão digital o leitor não
    # distingue recado novo de recado repetido, e o mesmo alerta foi reportado ao
    # dono OITO vezes em ticks consecutivos — canal que repete morre por
    # repetição, e o operador que aprende a ignorar este alarme é o mesmo que vai
    # ignorar o achado seguinte. `alerta_id` é o hash do texto e `alerta_n` a
    # contagem no journal: dois números que o leitor carrega de um tick para o
    # outro e que respondem, sem julgamento nenhum, "isto é novo?".
    alertas = [e for e in journal if e.get("kind") == "llm-attention"]
    r.fatos["alerta_n"] = len(alertas)
    if alertas:
        texto = str(alertas[-1].get("text") or "").strip()
        alerta_id = hashlib.sha256(texto.encode("utf-8")).hexdigest()[:12]
        r.fatos["ultimo_alerta"] = texto
        r.fatos["alerta_id"] = alerta_id
        if not terminal:
            r.add(
                "alerta-do-orquestrador",
                "act",
                f"[{alerta_id}] " + (texto[:400] or "(alerta sem texto)"),
                "regra alerta-do-orquestrador",
            )

    # HEAD DO CHECKOUT COMPARTILHADO — fato, deliberadamente não achado.
    #
    # Foi por ali que código não revisado entrou no `master` (370be19), por um bug
    # de cwd na sessão de dev. O sinal cobre a classe inteira: o HEAD do checkout
    # principal mexendo sem um merge correspondente no journal.
    #
    # Detectar isso exige comparar DOIS ticks, e este script é sem memória por
    # design — ele não escreve nada em lugar nenhum, porque toda mutação do run
    # pertence aos verbos sob o lock do diretório. Guardar estado ao lado do run
    # colocaria um segundo escritor justamente ali, e dois monitores rodando (o
    # laço e um humano) disputariam o arquivo. Então o script entrega os dois
    # números objetivos — o HEAD de agora e quantos merges o run já registrou — e
    # a comparação entre leituras é do agente, pela regra
    # `head-compartilhado-mexeu`. Vocabulário, não esperteza.
    r.fatos["head_projeto"] = head_do_projeto(project)
    merges = [e for e in journal if e.get("kind") == "unit-merged"]
    r.fatos["merges_n"] = len(merges)
    r.fatos["ultimo_merge"] = (
        {"story_key": merges[-1].get("story_key"), "branch": merges[-1].get("branch")}
        if merges
        else None
    )

    # ACHADO DE CONCLUSÃO, e o único que o estado terminal não tem direito de
    # calar. Todo `if not terminal` acima suprime achado de PROCESSO — supervisor
    # morto, turno aberto demais, sessão muda —, coisas que só existem enquanto
    # há processo. Este é da outra família: ele pergunta se o run ACABOU, e a
    # resposta importa mais, não menos, depois que o processo saiu.
    #
    # Sem ele um run que morreu no meio de uma story lia exatamente como um run
    # saudável: `stopped`, `finished: false`, a task em `dev-running`, e o
    # veredito `ok` com zero findings (medido em 2026-08-18). É o pior modo de
    # falha possível num alarme.
    if encerrado:
        no_meio = sorted(k for k, f in fases.items() if f not in FASES_TERMINAIS)
        if no_meio:
            r.add(
                "encerrado-sem-concluir",
                "act",
                f"run `{estado}` com story fora de fase terminal: "
                + ", ".join(f"{k} em `{fases[k]}`" for k in no_meio),
                "regra encerrado-sem-concluir",
            )

    return r, estado


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--run", default=None, help="ref curto ou id completo")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    lim, avisos = carregar_limiares()
    project = Path(args.project).resolve()
    r, estado = diagnosticar(project, args.run, lim)
    sev = r.severidade

    doc = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "state": estado,
        "severity": sev,
        "facts": r.fatos,
        "findings": r.findings,
        "limiares": lim,
        "regras": str(RULES_PATH),
    }
    if avisos:
        doc["avisos_regras"] = avisos

    if args.json:
        print(json.dumps(doc, ensure_ascii=False, indent=2))
    else:
        print(f"[{doc['ts']}] {r.fatos.get('run_id', '?')} — {estado.upper()} ({sev})")
        for aviso in avisos:
            print(f"  [watch] regras: {aviso}")
        sup = r.fatos.get("supervisor_vivo")
        if sup is not None:
            if sup:
                estado_sup = "vivo"
            elif r.fatos.get("pausado"):
                estado_sup = "ausente (esperado: run pausado)"
            elif r.fatos.get("terminal"):
                estado_sup = "ausente (esperado: run terminal)"
            else:
                estado_sup = "AUSENTE"
            print(
                f"  supervisor: {estado_sup}"
                f" · turnos {r.fatos.get('turnos', 0)}"
                f" · violações seguidas {r.fatos.get('violacoes_seguidas', 0)}"
            )
        for f in r.findings:
            print(f"  [{f['severity']}] {f['code']}: {f['detail']}")
            if f["acao"]:
                print(f"      → {f['acao']}")
        if not r.findings:
            print("  sem findings")

    if estado == "unknown" and sev == "critical":
        return 4
    return SEVERIDADES[sev]


if __name__ == "__main__":
    sys.exit(main())
