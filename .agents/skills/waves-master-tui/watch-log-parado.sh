#!/usr/bin/env sh
# Vigia o ponto cego do heartbeat: o `heartbeat.json` é escrito pelo ENGINE enquanto ele
# ESPERA a sessão, então engine esperando sessão morta e engine esperando sessão
# trabalhando emitem o mesmo sinal. Sessão que morre por erro de API fica ociosa no
# prompt com `state: working` e heartbeat de 2s, e o `dev_stall_grace_s` do engine não a
# resgata — turno encerrado por erro não é um Stop sem resultado.
#
# O que separa os dois casos é o log da sessão parar de crescer. É isso que este laço mede.
#
#   uso: watch-log-parado.sh [--project DIR] [--interval S] [--limiar S] [--repetir S]
#
# Emite:
#   LOG-PARADO <sessão> <min>   log sem escrita além do limiar, com state=working
#   LOG-VOLTOU <sessão>         voltou a crescer
#
# Complementar ao `watch.sh`, não substituto: aquele pega o que ACONTECE (troca de story,
# alerta do script); este pega o que DEIXA de acontecer dentro de uma sessão que o script
# ainda considera saudável. Arme os dois.

set -u

PROJECT="${BMAD_LOOP_PROJECT:-$PWD}"
INTERVAL=120
LIMIAR=480        # segundos de log parado que já pedem uma olhada no pane (8 min)
REPETIR=1800      # de quanto em quanto a MESMA condição volta a se anunciar

while [ $# -gt 0 ]; do
  case "$1" in
    --project)  PROJECT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --limiar)   LIMIAR="$2"; shift 2 ;;
    --repetir)  REPETIR="$2"; shift 2 ;;
    *) echo "argumento desconhecido: $1" >&2; exit 64 ;;
  esac
done

HEARTBEAT="$(dirname "$0")/heartbeat.py"

alertado=""
marcado=0

while true; do
  estado=$(python3 "$HEARTBEAT" --project "$PROJECT" --json 2>/dev/null | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("?|-"); raise SystemExit
f = d.get("facts") or {}
print((d.get("state") or "?") + "|" + (f.get("open_session") or "-"))
' 2>/dev/null) || estado="?|-"

  st=${estado%%|*}
  sessao=${estado##*|}

  # Só se cobra log crescendo quando HÁ sessão aberta. Em `verifying` não existe sessão
  # nenhuma — o portão é subprocesso do engine — e cobrar log ali seria alarme falso a
  # cada story.
  if [ "$st" = "working" ] && [ "$sessao" != "-" ]; then
    RUNDIR=$(ls -1dt "$PROJECT"/.waves/loop/runs/*/ 2>/dev/null | head -1)
    LOG="${RUNDIR}logs/$sessao.log"
    if [ -f "$LOG" ]; then
      agora=$(date +%s)
      mt=$(stat -c %Y "$LOG" 2>/dev/null || echo "$agora")
      idade=$((agora - mt))
      if [ "$idade" -ge "$LIMIAR" ]; then
        if [ "$sessao" != "$alertado" ] || [ $((agora - marcado)) -ge "$REPETIR" ]; then
          echo "LOG-PARADO $sessao — $((idade / 60))min sem escrita com state=working."
          echo "  olhe o PANE (leitura, não é attach): tmux capture-pane -p -t waves-<run-id>:1.0 | tail -40"
          echo "  se houver API Error num prompt ocioso: runbook sessao-travada, ramo do erro transitório"
          alertado="$sessao"
          marcado="$agora"
        fi
      else
        [ -n "$alertado" ] && echo "LOG-VOLTOU $sessao"
        alertado=""
        marcado=0
      fi
    fi
  fi

  sleep "$INTERVAL"
done
