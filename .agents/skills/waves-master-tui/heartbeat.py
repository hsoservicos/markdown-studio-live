#!/usr/bin/env python3
"""Batimento DETERMINÍSTICO de um run do waves: um veredito estruturado,
sem LLM, sobre o que está acontecendo e o que fazer a respeito.

    python3 heartbeat.py --project <raiz> [--json] [--run <ref>]

Os limiares e os marcadores do portão vêm do `rules.toml` ao lado deste arquivo,
não daqui: número que muda de projeto para projeto é configuração, e o script é
o mesmo em todo lugar.

Existe porque "está rodando?" nunca foi a pergunta certa. `waves list` diz
`running` com a sessão pendurada, com a árvore suja prestes a bloquear o
merge-back e com a story na última tentativa. Este script responde as perguntas
que de fato mudam o que se faz, cruzando sinais de naturezas diferentes, e
devolve `findings` acionáveis — cada um apontando o runbook da SKILL.md que o
resolve.

Python, não shell, de propósito: as quatro armadilhas de zsh que a SKILL.md
documentava (`$var[` como índice de array, `echo ""` virando `=` no awk, glob
varrendo run pausado de dias atrás, lista de fases escrita de memória) são todas
inexistentes aqui.

Saída: JSON com --json, texto legível caso contrário.
Exit: 0 ok · 1 vigiar · 2 agir · 3 crítico · 4 não deu pra medir.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    tomllib = None  # type: ignore[assignment]

RULES_PATH = Path(__file__).with_name("rules.toml")

# Defaults idênticos aos do `rules.toml` distribuído. Existem para o script
# continuar respondendo quando o arquivo some ou não parseia: um monitor que
# morre por causa da própria configuração deixa o run sem vigia, que é pior do
# que medir com número genérico.
_DEFAULTS = {
    "heartbeat_intervalo_s": 30.0,
    "heartbeat_batidas_perdidas": 6,
    "log_parado_min": 8,
    "medicoes_ate_decidir": 2,
    "intervalo_entre_medicoes_min": 5,
    "cadencia_pane_min": 30,
    "linhas_pane": 40,
    "linhas_log": 50,
}


def carregar_regras() -> tuple[dict, dict, list[str]]:
    """(limiares, projeto, avisos) — nunca levanta.

    Falha de leitura vira aviso no relatório, não exceção: o veredito sobre o
    run é mais importante que a integridade do arquivo de regras, e o operador
    precisa ver os dois.
    """
    avisos: list[str] = []
    if tomllib is None:
        return dict(_DEFAULTS), {}, ["python sem tomllib; usando limiares padrão"]
    try:
        dados = tomllib.loads(RULES_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return dict(_DEFAULTS), {}, [f"rules.toml ausente em {RULES_PATH}; usando padrões"]
    except (OSError, ValueError) as e:
        return dict(_DEFAULTS), {}, [f"rules.toml ilegível ({e}); usando padrões"]

    limiares = dict(_DEFAULTS)
    for chave, valor in (dados.get("limiares") or {}).items():
        if chave not in _DEFAULTS:
            avisos.append(f"rules.toml: limiar desconhecido ignorado: {chave}")
            continue
        if not isinstance(valor, (int, float)) or isinstance(valor, bool) or valor <= 0:
            avisos.append(f"rules.toml: limiar inválido ignorado: {chave}={valor!r}")
            continue
        limiares[chave] = valor
    return limiares, (dados.get("projeto") or {}), avisos


LIMIARES, PROJETO, AVISOS_REGRAS = carregar_regras()

# O engine reescreve tasks/<id>/heartbeat.json neste intervalo enquanto espera
# uma sessão. Batidas perdidas dão folga para host carregado sem deixar de
# detectar sessão morta.
HEARTBEAT_INTERVAL_S = float(LIMIARES["heartbeat_intervalo_s"])
HEARTBEAT_STALE_S = LIMIARES["heartbeat_batidas_perdidas"] * HEARTBEAT_INTERVAL_S

SEVERITY_ORDER = {"ok": 0, "watch": 1, "act": 2, "critical": 3}
EXIT_BY_SEVERITY = {"ok": 0, "watch": 1, "act": 2, "critical": 3}


def _run(argv: list[str], cwd: str | None = None, timeout: int = 30):
    """Subprocesso com argv em LISTA, nunca string de shell — é o que faz o
    `pgrep` abaixo não casar com a própria linha de comando do monitor (a
    armadilha de falso 'engine morto' que a SKILL.md documentava)."""
    try:
        p = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.SubprocessError) as e:
        return 127, "", str(e)


class Report:
    def __init__(self, project: Path):
        self.project = project
        self.facts: dict = {}
        self.findings: list[dict] = []

    def add(self, code: str, severity: str, detail: str, runbook: str = "") -> None:
        self.findings.append(
            {"code": code, "severity": severity, "detail": detail, "runbook": runbook}
        )

    @property
    def severity(self) -> str:
        if not self.findings:
            return "ok"
        return max((f["severity"] for f in self.findings), key=lambda s: SEVERITY_ORDER[s])


# --------------------------------------------------------------- coleta de fatos


def read_status(project: Path, ref: str | None) -> dict | None:
    """A verdade AUTORITATIVA sobre o run. `status` em texto imprime
    'in progress (or interrupted)' tanto pra run vivo quanto pra morto; o --json
    distingue com campos, e é o único que responde `paused_reason`."""
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


# Duas formas de invocar o MESMO engine: o console script (`bin/waves run`,
# o lançamento por terminal) e o módulo (`python -m riaworks_waves_loop.cli run`, que é
# como a TUI sobe um run). Casar só a primeira dá "engine morto" com o engine
# vivo em todo run lançado pela TUI.
_ENGINE_PAT = r"bin/waves|riaworks_waves_loop\.cli"


def _engine_lines() -> list[str]:
    rc, out, _ = _run(["pgrep", "-af", _ENGINE_PAT])
    if rc != 0:
        return []
    # id no argv só existe no `resume`; um `run` novo pode não carregar id
    # nenhum, então casar por id daria falso negativo — "engine não encontrado"
    # em severidade crítica, com o engine vivo e saudável.
    # `resolve` entra na lista porque `resolve --resume <id>` PASSA A SER o engine
    # do run: sem ele o heartbeat grita `engine-ausente` critical durante todo o
    # re-drive, e o runbook que esse finding aponta faz `reset --hard` em run vivo.
    # Note que " resume" não casa `--resume`: o traço ocupa o lugar do espaço.
    return [ln for ln in out.splitlines() if " run" in ln or " resume" in ln or " resolve" in ln]


def engine_alive(run_id: str) -> bool:
    """Um processo `waves run|resume` vivo. ATENÇÃO: engine ausente NÃO
    significa problema — um run pausado encerra o processo de propósito (não há
    daemon entre pausas). Só é sintoma quando cruzado com `status` dizendo
    in-progress."""
    return bool(_engine_lines())


def engine_pid(run_id: str) -> int | None:
    """PID do engine, pelo mesmo casamento de `engine_alive`. Separado dele
    porque quem quer os FILHOS precisa do número, e quem só quer saber se está
    vivo não deve pagar por isso."""
    for line in _engine_lines():
        try:
            return int(line.split(None, 1)[0])
        except (ValueError, IndexError):
            return None
    return None
    return None


# Os comandos do `[verify]`, vindos de `[projeto] marcadores_portao` no
# rules.toml. Casados no argv do filho DIRETO do engine — o `/bin/sh -c` que
# ele mesmo abriu — e não numa varredura global de `ps`, que confundiria a
# suíte de outra pessoa com o portão deste run.
#
# Casados por SUBSTRING, então nenhum marcador pode depender de flag: uma flag
# nova no `[verify]` faz o marcador parar de casar em silêncio, e a suíte longa
# volta a ser relatada como ociosidade — o ponto cego exato que esta função
# existe para fechar. Marcador vai sem o runner e sem flag.
GATE_MARKERS = tuple(m for m in PROJETO.get("marcadores_portao", ()) if isinstance(m, str) and m)


def gate_running(pid: int | None) -> str | None:
    """O comando do portão rodando como filho do engine, ou None.

    Fecha o ponto cego que faz uma suíte de minutos ser reportada como
    ociosidade: ociosidade real e portão em curso são situações OPOSTAS, e sem
    esta checagem mostram o mesmo texto."""
    if not pid or not GATE_MARKERS:
        return None
    rc, out, _ = _run(["pgrep", "-P", str(pid), "-a"])
    if rc != 0:
        return None
    for line in out.splitlines():
        argv = line.split(None, 1)[1] if " " in line else ""
        for marker in GATE_MARKERS:
            if marker in argv:
                return marker
    return None


def _compilar_regex_banco():
    """Regex de `[projeto] regex_banco_suite`, ou None se vazio/inválido.

    Vazio é a configuração certa para projeto sem banco por suíte; inválido
    vira aviso, nunca exceção."""
    padrao = PROJETO.get("regex_banco_suite") or ""
    if not isinstance(padrao, str) or not padrao.strip():
        return None
    try:
        return re.compile(padrao)
    except re.error as e:
        AVISOS_REGRAS.append(f"rules.toml: regex_banco_suite inválida ({e}); checagem desligada")
        return None


SUITE_DB_RE = _compilar_regex_banco()


def suite_databases() -> dict[str, list[int]]:
    """Bancos descartáveis em uso por suíte viva, por PID.

    Duas suítes no MESMO banco é corrupção em andamento: nada serializa os dois
    processos e o segundo derruba o primeiro, com as duas saindo vermelhas por
    um erro que não aponta para a causa.

    Conta ÁRVORE, não processo. Um pid cujo pai também carrega o marcador é o
    mesmo lançamento visto duas vezes: quando a variável vai inline no comando,
    o shell forka para o pipeline e pai e filho aparecem com o argv idêntico.
    Contar os dois grita `critical` com UMA suíte rodando — e alarme falso em
    severidade crítica é pior que detecção nenhuma, porque treina quem lê a
    ignorá-la."""
    if SUITE_DB_RE is None:
        return {}
    rc, out, _ = _run(["ps", "-eo", "pid=,ppid=,args="])
    if rc != 0:
        return {}
    marcados: dict[int, tuple[int, str]] = {}
    for line in out.splitlines():
        m = SUITE_DB_RE.search(line)
        if not m:
            continue
        campos = line.split(None, 2)
        if len(campos) < 3:
            continue
        try:
            pid, ppid = int(campos[0]), int(campos[1])
        except ValueError:
            continue
        marcados[pid] = (ppid, m.group(1))
    porbanco: dict[str, list[int]] = {}
    for pid, (ppid, banco) in sorted(marcados.items()):
        # Raiz da árvore marcada: o pai não carrega o marcador.
        if ppid in marcados:
            continue
        porbanco.setdefault(banco, []).append(pid)
    return porbanco


def max_dev_attempts(project: Path) -> int | None:
    """`limits.max_dev_attempts` do policy.toml, ou None se não der pra ler.

    None faz a detecção de última tentativa se calar — um teto desconhecido não
    autoriza afirmar que a story está no fim da corda."""
    policy = project / ".waves/loop" / "policy.toml"
    try:
        texto = policy.read_text(encoding="utf-8")
    except OSError:
        return None
    try:
        import tomllib

        return int(tomllib.loads(texto).get("limits", {}).get("max_dev_attempts"))
    except Exception:  # noqa: BLE001 # nosec B110 - toml inválido cai no regex abaixo
        pass
    m = re.search(r"^\s*max_dev_attempts\s*=\s*(\d+)", texto, re.M)
    return int(m.group(1)) if m else None


def open_session(run_dir: Path) -> dict | None:
    """A última `session-start` sem `session-end` correspondente. Mesma lógica
    que a TUI usa (tui/data.py:_open_session_start), reimplementada aqui pra não
    depender de import interno do pacote."""
    journal = run_dir / "journal.jsonl"
    if not journal.is_file():
        return None
    open_entry = None
    active = None
    try:
        with journal.open(encoding="utf-8") as fh:
            for line in fh:
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                kind = e.get("kind")
                if kind == "session-start" and e.get("task_id") is not None:
                    active = str(e["task_id"])
                    open_entry = e
                elif kind == "session-end" and str(e.get("task_id")) == active:
                    active, open_entry = None, None
    except OSError:
        return None
    return open_entry


def heartbeat_age(run_dir: Path, task_id: str) -> float | None:
    """Idade, em segundos, do heartbeat da sessão aberta. É a prova de vida FORTE
    — melhor que delta de CPU (que a doutrina antiga usava) e incomparavelmente
    melhor que crescimento de log (58% dos bytes são redraw ANSI: spinner
    pendurado cresce igual a trabalho)."""
    hb = run_dir / "tasks" / task_id / "heartbeat.json"
    if not hb.is_file():
        return None
    try:
        payload = json.loads(hb.read_text(encoding="utf-8"))
        ts = float(payload.get("ts", 0))
    except (OSError, ValueError, TypeError):
        try:
            ts = hb.stat().st_mtime
        except OSError:
            return None
    return max(0.0, time.time() - ts)


def dirty_paths(project: Path) -> list[str]:
    """O predicado EXATO que o engine usa pra recusar um merge-back
    (verify.py:dirty_paths). Reproduzido byte a byte de propósito: qualquer
    aproximação aqui responde a pergunta errada — `.waves/loop/` inteiro é
    excluído, e arquivo NÃO RASTREADO conta."""
    rc, out, _ = _run(
        [
            "git",
            "status",
            "--porcelain",
            "-z",
            "-uall",
            "--",
            ".",
            ":(exclude).waves/loop",
        ],
        cwd=str(project),
    )
    if rc != 0:
        return []
    return [seg[3:] for seg in out.split("\0") if len(seg) > 3]


def last_boundary_report(run_dir: Path) -> dict | None:
    """O rollup `epic-boundary-report` mais recente (Patch 10). É o que separa
    'a fronteira fechou' de 'a fronteira rodou pela metade e ninguém contou'."""
    journal = run_dir / "journal.jsonl"
    if not journal.is_file():
        return None
    found = None
    try:
        with journal.open(encoding="utf-8") as fh:
            for line in fh:
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if e.get("kind") == "epic-boundary-report":
                    found = e
    except OSError:
        return None
    return found


def new_attention(run_dir: Path) -> list[str]:
    """Linhas do ATTENTION ainda não vistas por este monitor.

    O ATTENTION é append-only e NUNCA é limpo quando a pendência é resolvida —
    ler a última linha como estado atual produz alarme falso. A marca d'água
    fica em .waves/loop/ (que o próprio engine exclui do predicado de árvore
    suja), então o monitor não pode sujar a árvore que ele vigia."""
    att = run_dir / "ATTENTION"
    if not att.is_file():
        return []
    mark = run_dir / ".heartbeat-watermark"
    first_run = not mark.is_file()
    try:
        seen = 0 if first_run else int(mark.read_text().strip())
    except (OSError, ValueError):
        seen = 0
    try:
        text = att.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    if len(text) < seen:  # arquivo truncado/recriado
        seen = 0
    try:
        mark.write_text(str(len(text)))
    except OSError:
        pass
    if first_run:
        # Na PRIMEIRA execução tudo é "novo", e despejar o histórico inteiro é
        # exatamente o alarme falso contra o qual a doutrina avisa: o ATTENTION é
        # append-only e nunca é limpo, então uma linha `ACTION REQUIRED` de horas
        # atrás segue lá idêntica depois do resume que a resolveu. Só semeia a
        # marca d'água e segue; da segunda chamada em diante, "novo" é novo mesmo.
        return []
    return [ln for ln in text[seen:].strip().splitlines() if ln.strip()]


def sprint_status_map(project: Path) -> dict[str, str]:
    """`chave: status` do quadro. Serve para separar story realmente pendente de
    story já integrada à mão: a fase no estado do run continua `deferred` para
    sempre, então sem este cruzamento o finding nunca mais sairia. Arquivo ausente
    devolve mapa vazio — reportar de novo é melhor que calar."""
    caminho = project / "_bmad-output" / "implementation-artifacts" / "sprint-status.yaml"
    quadro: dict[str, str] = {}
    try:
        linhas = caminho.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    for linha in linhas:
        if not linha.startswith(" ") or ":" not in linha:
            continue
        chave, _, valor = linha.partition(":")
        chave = chave.strip()
        # comentário na mesma linha da chave é proibido pelo project-context, mas
        # se algum aparecer o valor tem de sobreviver a ele em vez de virar lixo.
        valor = valor.split("#", 1)[0].strip()
        if chave and valor and not chave.startswith("#"):
            quadro[chave] = valor
    return quadro


# ------------------------------------------------------------------- diagnóstico


def diagnose(project: Path, ref: str | None) -> tuple[Report, str]:
    r = Report(project)
    status = read_status(project, ref)
    if status is None:
        r.add(
            "sem-status",
            "critical",
            "`waves status --json` não respondeu. Se for 'no runs found', "
            "confira --project: o default é o cwd, e de dentro de uma subpasta "
            "isso é diretório errado, não run perdido.",
            "runbook: diagnosticar",
        )
        return r, "unknown"

    run_id = status.get("run_id", "")
    run_dir = project / ".waves/loop" / "runs" / run_id
    alive = engine_alive(run_id)
    epid = engine_pid(run_id) if alive else None
    gate = gate_running(epid)
    bancos = suite_databases()
    teto = max_dev_attempts(project)
    session = open_session(run_dir)
    task_id = str(session.get("task_id", "")) if session else ""
    age = heartbeat_age(run_dir, task_id) if task_id else None
    dirty = dirty_paths(project)
    boundary = last_boundary_report(run_dir)
    fresh_attention = new_attention(run_dir)

    r.facts = {
        "run_id": run_id,
        "status": status.get("status"),
        "paused_stage": status.get("paused_stage"),
        "paused_reason": status.get("paused_reason"),
        "crashed": status.get("crashed"),
        "finished": status.get("finished"),
        "engine_alive": alive,
        "open_session": task_id or None,
        "session_role": (session or {}).get("role"),
        "heartbeat_age_s": None if age is None else round(age, 1),
        "dirty_paths": dirty,
        "new_attention_lines": fresh_attention,
        "gate_running": gate,
        "suite_databases": {db: pids for db, pids in bancos.items()},
        "max_dev_attempts": teto,
    }

    # --- 1. árvore suja com run VIVO: a mina que já custou as stories 1.1 e 1.4
    # Detectado cedo limpa-se em segundos; detectado tarde, a story já rodou
    # inteira (dev + ATDD + review + commit) e escala NO MERGE.
    # `stopped` entra na conta junto com `finished`: run parado não tem story em
    # voo para escalar, e alarmar como se tivesse manda limpar por urgência falsa.
    em_voo = (
        not status.get("finished")
        and not status.get("stopped")
        and status.get("status") != "paused"
    )
    if dirty and em_voo:
        r.add(
            "arvore-suja-com-run-vivo",
            "act",
            f"{len(dirty)} caminho(s) não commitados no checkout principal: "
            f"{', '.join(dirty[:5])}{'…' if len(dirty) > 5 else ''}. "
            "Com isolation=worktree a story em voo roda até o fim e ESCALA no merge-back.",
            "runbook: limpar-arvore",
        )
    elif dirty:
        r.add(
            "arvore-suja",
            "watch",
            f"{len(dirty)} caminho(s) não commitados (run não está em voo, então "
            "não há story em risco agora — mas o próximo `run`/`resume` recusa o preflight).",
            "runbook: limpar-arvore",
        )

    # --- 2. o run parou por conta própria
    # Story deferida. O engine NÃO pausa por isso: esgotadas as tentativas ele segue
    # para a próxima e a story volta a `backlog`, sem finding e sem ATTENTION
    # bloqueante — fica invisível até a primeira story que dependa dela escalar.
    # Vem ANTES dos ramos que dão `return` cedo (crashed/paused/finished): quando o
    # run está pausado por uma escalação, a story deferida costuma ser a CAUSA, e é
    # justamente aí que ela não pode faltar no relatório. Cruzamos com o
    # sprint-status porque a fase no estado do run continua `deferred` para sempre,
    # inclusive depois de a story ser integrada à mão.
    deferidas = [
        str(t.get("story_key")) for t in status.get("tasks", []) if t.get("phase") == "deferred"
    ]
    if deferidas:
        quadro = sprint_status_map(project)
        # `awaiting-operator` fecha a story tanto quanto `done`: o `[operator]` do
        # policy.toml so a concede quando o trabalho de agente terminou e foi
        # COMMITADO, e o que falta e acao externa que nenhum runbook alcanca. Sem
        # ela aqui, uma story ja integrada alarma para sempre.
        RESOLVIDAS = {"done", "awaiting-operator"}
        pendentes = [s for s in deferidas if quadro.get(s) not in RESOLVIDAS]
        if pendentes:
            r.add(
                "story-deferida",
                "act",
                "story deferida, com o trabalho parado no branch e fora do épico: "
                + "; ".join(pendentes)
                + ".",
                "runbook: story-deferida",
            )

    # Duas suítes no MESMO banco descartável. Não é risco futuro: quando aparece,
    # a corrupção já está acontecendo, e o sintoma (`relation … does not exist`,
    # deadlock, lista de migrações vazia, `beforeAll` derrubando o arquivo
    # inteiro) aponta pra qualquer lugar menos pra causa. Crítico porque o
    # prejuízo não é só o teste: uma story pode ser DEFERIDA por falha fantasma e
    # queimar tentativa que nunca foi dela.
    colididos = {db: pids for db, pids in bancos.items() if len(pids) > 1}
    if colididos:
        detalhe = "; ".join(
            f"{db}: {len(pids)} suítes (pids {', '.join(str(p) for p in pids)})"
            for db, pids in sorted(colididos.items())
        )
        r.add(
            "colisao-de-banco",
            "critical",
            f"duas ou mais suítes contra o mesmo banco descartável — {detalhe}. "
            "Os testes dropam os sete schemas e nada serializa dois processos: "
            "as duas saem vermelhas por causa uma da outra. Rode uma por vez, ou "
            "aponte a sua para um banco criado só pra ela.",
            "",
        )

    # Story na ÚLTIMA tentativa. O docstring deste script promete isso desde a
    # primeira versão e nunca entregou: uma story que ainda tem margem e uma na
    # última chance produziam o mesmo `WORKING (ok)`. Se esta cair, ela sai do
    # épico em silêncio — é a diferença entre olhar agora e descobrir depois.
    if teto:
        for t in status.get("tasks", []):
            if t.get("phase") == "dev-running" and int(t.get("attempt") or 0) >= teto:
                r.add(
                    "ultima-tentativa",
                    "watch",
                    f"{t.get('story_key')} está na tentativa {t.get('attempt')} de "
                    f"{teto} (`limits.max_dev_attempts`). Se o verify reprovar de "
                    "novo, a story volta pra backlog e o run segue sem parar.",
                    "runbook: story-deferida",
                )

    if status.get("crashed"):
        r.add(
            "run-crashed",
            "critical",
            f"run caiu: {status.get('crash_error')}. Traceback completo em {run_dir}/crash.txt.",
            "runbook: recuperar",
        )
        return r, "crashed"

    if status.get("paused_reason"):
        stage = status.get("paused_stage") or ""
        # Escalação CRITICAL e pausa de fronteira/rollback pedem comandos
        # DIFERENTES, e o comando errado só devolve um erro seco.
        if "escalat" in stage or status.get("paused_story_key"):
            r.add(
                "pausa-escalacao",
                "act",
                f"{status.get('paused_reason')}",
                "runbook: resolver-escalacao",
            )
        else:
            r.add("pausa", "act", f"{status.get('paused_reason')}", "runbook: retomar")
        return r, "paused"

    if status.get("finished"):
        r.add("finalizado", "ok", "run concluído.", "")
        return r, "finished"

    # Parada deliberada (`waves stop`, ou o botão da TUI). Sem este ramo o run
    # cai no `engine-ausente` lá embaixo e vira CRÍTICO permanente — alarme falso
    # que se repete para sempre num monitor armado, e que descreve como queda o que
    # foi decisão de operador.
    # **Vem DEPOIS de pausa e de finished, nunca antes.** Um run pausado em
    # fronteira de épico também traz `stopped: true` (o engine encerra o processo de
    # propósito), e testar `stopped` primeiro engole o `paused_reason` — o run 4a2d,
    # pausado na fronteira do épico 0, foi relatado como "parada deliberada" e o
    # motivo real sumiu do relatório. Pausa por escalação escapou por acidente
    # (`stopped: false`), mas confiar nisso é apostar num detalhe do engine.
    if status.get("stopped"):
        r.add(
            "run-parado",
            "act",
            "run parado deliberadamente (stop gracioso), não caiu: `stopped: true`, "
            "`crashed: false`, sem `paused_reason`. Nada em voo. Confira se a parada "
            "foi sua antes de relançar — e note que `stop` fecha a janela do "
            "`resolve`, então story escalada só volta em run novo.",
            "runbook: retomar",
        )
        return r, "stopped"

    # --- 3. fronteira que voltou incompleta (Patch 10). Advisory pro engine,
    # nunca advisory pro operador: o trabalho daquelas etapas não existe.
    if boundary and boundary.get("failed"):
        nomes = "; ".join(f"{d.get('name')} ({d.get('status')})" for d in boundary["failed"])
        r.add(
            "fronteira-incompleta",
            "act",
            f"épico {boundary.get('epic')}: {boundary.get('ok')}/{boundary.get('total')} "
            f"etapas ok. Não completaram: {nomes}.",
            "runbook: refazer-fronteira",
        )

    # --- 4. vida da sessão — o cruzamento que responde "trabalhando?"
    if not alive:
        r.add(
            "engine-ausente",
            "critical",
            "status diz in-progress mas nenhum processo `waves run|resume` existe. "
            "(Um run PAUSADO encerra o processo de propósito — mas este não está pausado.)",
            "runbook: recuperar",
        )
        return r, "dead"

    if session is None:
        # O portão `[verify]` roda ENTRE sessões: nenhuma sessão aberta, engine
        # ocupado, e nada no journal até a decisão sair. Sem este ramo, os ~9
        # minutos de suíte eram reportados com o texto de "investigue se durar" —
        # o conselho oposto ao correto, que é esperar.
        if gate:
            r.add(
                "portao-rodando",
                "ok",
                f"portão [verify] em curso ({gate}) — nenhuma sessão aberta porque "
                "não é hora de haver uma. A suíte de integração leva ~7–9 min; "
                "esperar é o certo.",
                "",
            )
            return r, "verifying"
        # normal por segundos entre unidades; suspeito se durar
        r.add(
            "sem-sessao-aberta",
            "watch",
            "engine vivo, nenhuma sessão de agente aberta e nenhum comando de "
            "portão rodando — normal entre unidades. Se persistir por mais de "
            "alguns minutos, investigue.",
            "",
        )
        return r, "idle"

    if age is None:
        r.add(
            "sessao-sem-heartbeat",
            "watch",
            f"sessão {task_id} aberta e ainda sem heartbeat.json — normal nos "
            f"primeiros ~{int(HEARTBEAT_INTERVAL_S)}s.",
            "",
        )
        return r, "starting"

    if age > HEARTBEAT_STALE_S:
        r.add(
            "sessao-travada",
            "critical",
            f"heartbeat de {task_id} tem {age:.0f}s (limite {HEARTBEAT_STALE_S:.0f}s). "
            "O laço de espera do orquestrador parou de bater: sessão morta ou host "
            "congelado. Crescimento de log NÃO desmente isso — 58% é redraw ANSI.",
            "runbook: sessao-travada",
        )
        return r, "stalled"

    return r, "working"


# ------------------------------------------------------------------------ saída


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--run", default=None, help="ref curto ou id completo")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    project = Path(args.project).resolve()
    report, state = diagnose(project, args.run)
    severity = report.severity

    # `needs_llm`: onde script não alcança. Um humano/LLM precisa julgar quando
    # há uma decisão a tomar (que runbook? o log mostra trabalho ou laço?), nunca
    # pra confirmar saúde — isso é determinístico e já foi respondido acima.
    needs_llm = state in ("stalled", "paused", "crashed", "dead") or any(
        f["code"] == "fronteira-incompleta" for f in report.findings
    )

    doc = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "state": state,
        "severity": severity,
        "needs_llm": needs_llm,
        "facts": report.facts,
        "findings": report.findings,
        # Os limiares viajam com o veredito de propósito: as duas checagens que
        # o script NÃO faz — log sem escrita e duração fora da curva — são de
        # quem lê, e quem lê precisa do número que este run está usando, não do
        # número que memorizou de outro projeto.
        "limiares": LIMIARES,
        "regras": str(RULES_PATH),
    }
    if AVISOS_REGRAS:
        doc["avisos_regras"] = AVISOS_REGRAS

    if args.json:
        print(json.dumps(doc, ensure_ascii=False, indent=2))
    else:
        f = report.facts
        print(f"[{doc['ts']}] {f.get('run_id', '?')} — {state.upper()} ({severity})")
        for aviso in AVISOS_REGRAS:
            print(f"  [watch] regras: {aviso}")
        if f.get("open_session"):
            hb = f.get("heartbeat_age_s")
            print(
                f"  sessão: {f['open_session']} ({f.get('session_role')})"
                + (f" · heartbeat {hb}s" if hb is not None else " · sem heartbeat ainda")
            )
        for finding in report.findings:
            print(f"  [{finding['severity']}] {finding['code']}: {finding['detail']}")
            if finding["runbook"]:
                print(f"      → {finding['runbook']}")
        for line in f.get("new_attention_lines", []):
            print(f"  ATTENTION (novo): {line}")
        if not report.findings and not f.get("new_attention_lines"):
            print("  nada a reportar.")

    return EXIT_BY_SEVERITY.get(severity, 4)


if __name__ == "__main__":
    sys.exit(main())
