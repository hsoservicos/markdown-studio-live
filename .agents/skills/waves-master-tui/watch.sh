#!/usr/bin/env sh
# Laço de vigília de um run: roda o heartbeat determinístico em intervalo fixo e
# imprime UMA linha só quando há o que fazer. Feito para ser armado como monitor
# de sessão de agente, que acorda a cada linha de stdout.
#
#   uso: watch.sh [--project DIR] [--interval SEGUNDOS] [--repetir SEGUNDOS]
#
# Emite:
#   ALERTA rc=N     heartbeat saiu de ok — 1 vigiar · 2 agir · 3 crítico · 4 não mediu
#   AINDA Nmin      a MESMA condição segue de pé (só a cada --repetir, não a cada ciclo)
#   NORMALIZADO x   a condição que alertava passou
#   AVANCO a -> b   mudou o estado ou a sessão aberta (troca de story, fim do run)
#   MEDICAO-FALHOU  o próprio heartbeat não respondeu; sem esta linha, um script
#                   quebrado seria silêncio, e silêncio se confunde com saúde
#
# Silêncio aqui significa `working`: NÃO abra o log para "confirmar" — 58% dele é
# redraw ANSI e spinner pendurado cresce igual a trabalho (ver SKILL.md).

set -u

PROJECT="${BMAD_LOOP_PROJECT:-$PWD}"
INTERVAL=120
REPETIR_S=1800   # de quanto em quanto uma condição INALTERADA volta a se anunciar

while [ $# -gt 0 ]; do
  case "$1" in
    --project)  PROJECT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --repetir)  REPETIR_S="$2"; shift 2 ;;
    *) echo "argumento desconhecido: $1" >&2; exit 64 ;;
  esac
done

HEARTBEAT="$(dirname "$0")/heartbeat.py"

# A identidade vigiada é `state` + `facts.open_session`. Ler só `state` não vê
# troca de story: ele fica em "working" de uma story para a outra. E o nome da
# chave é `facts.open_session` — não existe `session.task` no JSON; ler a chave
# errada não dá erro, só devolve None para sempre e mata a detecção de avanço.
identidade() {
  python3 "$HEARTBEAT" --project "$PROJECT" --json 2>/dev/null | python3 -c '
import sys, json
d = json.load(sys.stdin)
print(d.get("state", "?"), "|", (d.get("facts") or {}).get("open_session") or "-")
' 2>/dev/null
}

anterior=""
alerta_visto=""      # assinatura rc+identidade do último alerta emitido
alerta_em=0          # epoch em que ele foi emitido

while true; do
  saida=$(python3 "$HEARTBEAT" --project "$PROJECT" 2>&1)
  rc=$?
  atual=$(identidade) || atual=""
  [ -n "$atual" ] || atual="MEDICAO-FALHOU"

  if [ "$rc" -ne 0 ]; then
    # Repetir o MESMO alerta a cada ciclo é o que derruba o monitor por excesso, e
    # monitor derrubado é vigília zero. Uma condição que não mudou só volta a falar
    # depois de REPETIR_S, para não sumir de vista num run pausado por horas.
    assinatura="$rc|$atual"
    agora=$(date +%s)
    if [ "$assinatura" != "$alerta_visto" ] || [ $((agora - alerta_em)) -ge "$REPETIR_S" ]; then
      [ "$assinatura" = "$alerta_visto" ] && echo "AINDA: $(( (agora - alerta_em) / 60 ))min na mesma condição"
      echo "ALERTA rc=$rc  [$atual]"
      echo "$saida"
      alerta_visto="$assinatura"
      alerta_em="$agora"
    fi
  else
    # Voltou ao normal: o próximo alerta fala de novo, mesmo que seja o mesmo de antes.
    [ -n "$alerta_visto" ] && echo "NORMALIZADO: $atual"
    alerta_visto=""
    alerta_em=0
    if [ "$atual" != "$anterior" ] && [ -n "$anterior" ]; then
      echo "AVANCO: $anterior  ->  $atual"
    fi
  fi

  anterior="$atual"
  sleep "$INTERVAL"
done
