# How-to: Deploy no Coolify com Cloudflare Tunnel

Guia completo de como deployar o Markdown-Studio no Coolify usando um túnel da Cloudflare.

> **Guia passo a passo detalhado**: `docs/how-to/coolify-deploy-step-by-step.md`

## Visão Geral

O Markdown-Studio será publicado em `https://mkdeditor.appservice.tec.br/` usando:

- **Coolify** (v4.3.16) para orquestração e deploy
- **Cloudflare Tunnel** para acesso externo seguro
- **GitHub** como fonte do código (recomendado)
- **Docker** para containerização

## Pré-requisitos

- [x] Coolify rodando (v4.3.16+)
- [x] Cloudflare account com domínio `appservice.tec.br`
- [x] GitHub repository `hsoservicos/markdown-studio-live`
- [x] Docker rodando no servidor

## Opções de Deploy

### Opção A: Deploy via GitHub (Recomendado)

**Vantagens:**

- Deploy automático a cada push no `main`
- Rollback fácil via histórico de commits
- Integração com CI/CD (quality gate antes do deploy)
- Sem necessidade de acesso SSH ao servidor

**Fluxo:**

```
GitHub push → GitHub Actions → Build Docker → Push GHCR → Coolify deploy
```

### Opção B: Deploy Local (Build no Servidor)

**Vantagens:**

- Controle total sobre o build
- Sem dependência de GitHub Actions
- Deploy manual quando necessário

**Fluxo:**

```
Coolify → git pull → docker build → docker run
```

## Configuração no Coolify

### 1. Criar Novo Resource

1. Acesse o Coolify Dashboard: `http://localhost:8000`
2. Clique em **New Resource**
3. Selecione **Application**
4. Escolha **Dockerfile** como build pack

### 2. Configurar Fonte do Código

#### Opção A: GitHub Repository (Recomendado)

1. Selecione **Git Source**
2. Escolha **GitHub App** ou **Deploy Key**
3. Autorize o Coolify a acessar o repositório
4. Selecione o repositório `hsoservicos/markdown-studio-live`
5. Branch: `master`
6. Base Directory: `/`

#### Opção B: Docker Image (GHCR)

1. Selecione **Docker Image**
2. Image: `ghcr.io/hsoservicos/markdown-studio-live:latest`
3. Port: `80`

### 3. Configurar Build Pack

1. Build Pack: **Dockerfile**
2. Dockerfile Location: `./Dockerfile`
3. Base Directory: `/`

### 4. Configurar Network

1. Port: `80` (nginx interna)
2. Domain: `mkdeditor.appservice.tec.br`
3. Protocol: **HTTP** (Cloudflare handles HTTPS)

### 5. Configurar Variáveis de Ambiente

```bash
# Nenhuma variável de ambiente necessária
# O app é 100% client-side
```

### 6. Configurar Health Check

```bash
# Health check path: /
# Interval: 30s
# Timeout: 3s
# Retries: 3
```

## Configuração do Cloudflare Tunnel

### 1. Criar Tunnel (se ainda não existe)

1. Acesse o Cloudflare Dashboard
2. Vá para **Zero Trust** → **Networks** → **Tunnels**
3. Clique em **Create a tunnel**
4. Nome: `coolify-tunnel`
5. Copie o Tunnel ID

### 2. Configurar Routes

1. No tunnel, vá para **Configure**
2. Clique em **Add route**
3. Configuração:

| Campo       | Valor                   |
| ----------- | ----------------------- |
| Subdomain   | `mkdeditor`             |
| Domain      | `appservice.tec.br`     |
| Path        | (vazio)                 |
| Service URL | `http://localhost:5002` |

Após preencher, clique em **Add route**.

> **A porta precisa ser `5002`.** O Coolify mapeia `5002:80` (`ports_mappings` da
> aplicação) — a porta 80 do nginx fica interna ao container. Apontar o tunnel para
> `localhost:80` devolve **502 Bad Gateway**.

### 3. Configurar DNS

O Cloudflare cria automaticamente um registro CNAME:

```
mkdeditor.appservice.tec.br → <tunnel-id>.cfargotunnel.com
```

### 4. Verificar SSL/TLS

1. No Cloudflare, vá para **SSL/TLS**
2. Mode: **Full (Strict)** ou **Full**
3. **Always Use HTTPS**: Ativado

## Deploy Automático via Webhook (GitHub → Coolify)

Push em `main` dispara o build sozinho: quem publica em produção é o webhook
nativo do Coolify, não um workflow do GitHub. O `.github/workflows/docker.yml`
apenas builda e publica a imagem no GHCR.

### 1. Copiar URL e segredo no Coolify

1. No Coolify, abra a aplicação
2. Vá para **Configuration** → **Webhooks**
3. Copie a **Webhook URL** (modo manual) e o **segredo**

### 2. Criar o webhook no GitHub

No repositório, vá para **Settings** → **Webhooks** → **Add webhook**:

| Campo        | Valor                          |
| ------------ | ------------------------------ |
| Payload URL  | Webhook URL copiada no Coolify |
| Content type | `application/json`             |
| Secret       | Segredo copiado no Coolify     |
| Which events | **Just the push event**        |
| Active       | Marcado                        |

### 3. Comportamento

- Só o branch configurado na aplicação (`main`) dispara deploy; pushes em
  branches de Dependabot ou de feature são recebidos e ignorados.
- Commits com `[skip ci]` ou `[skip cd]` não disparam deploy.
- A assinatura `X-Hub-Signature-256` é validada contra o segredo; sem ela a
  entrega falha.
- O deploy aparece em **Deployments** com a origem `webhook`.

### 4. Verificar

1. Faça um push em `main`
2. **Deployments** → nova entrada com origem `webhook`
3. `https://mkdeditor.appservice.tec.br` serve o build novo

### 5. Verificação operacional (checklist repetível)

Para provar que a cadeia segue de pé sem fazer push de teste, rode:

```bash
npm run deploy:audit
```

O script (`scripts/deploy-audit.sh`) valida as condições operacionais e sai com
código ≠ 0 se alguma falhar:

| Seção     | O que prova                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git       | `local = origin/main`, working tree limpo                                                                                                                                                 |
| Webhook   | hook existe, ativo, evento `push`, `application/json`, última entrega                                                                                                                     |
| Proteção  | check `quality` exigido, `strict`, `enforce_admins`, PR obrigatório                                                                                                                       |
| Deploy    | último deploy **origem=webhook**, `finished`, commit = HEAD da branch, fila vazia, histórico de falhas exposto, **canal de alerta de falha ativo**, API do Coolify desabilitada, 0 tokens |
| Container | `running` + `healthcheck healthy`                                                                                                                                                         |
| Produção  | `GET /` = 200 e o bundle servido é idêntico ao build local                                                                                                                                |

Requer `gh` autenticado, `git`, `curl` e `jq`. Os checks de fila/segurança usam
`docker exec` no container do banco e viram **warn** (não falham) se ele não existir.

### 6. Gotchas (o que engana)

- **"Last delivery: OK" no GitHub ≠ deploy aconteceu.** O Coolify responde
  `HTTP 200` mesmo quando recusa a entrega (`[{"status":"failed","message":"Invalid signature."}]`),
  então o GitHub marca `OK` de qualquer jeito. O sinal real de aceite é a fila
  de deploys com `is_webhook=true` no commit correspondente.
- **O segredo é criptografado no banco** (prefixo `eyJpdiI6`, formato Laravel).
  Não dá para forjar uma assinatura lendo o Postgres — só o Coolify consegue
  validar, o que é exatamente o esperado. Prova de aceite: entregas reais do GitHub.
- **O filtro é repo + branch.** Entrega com branch ou repositório errado responde
  `Nothing to do. No applications found...` e é descartada sem virar erro.
- **`ping` responde `pong`** e não gera deploy — é o teste de saúde do hook.
- **O `Content-Type` registrado na entrega não bate com a config do hook.**
  O hook está salvo com `config.content_type = application/json`, mas o registro
  de entrega (`GET .../deliveries/{id}` → `request.headers`) reporta
  `application/x-www-form-urlencoded`. Independente da causa, **a validação
  passa**: o `X-Hub-Signature-256` é conferido contra o corpo exato transmitido
  e o Coolify parseia o payload — prova disso é que deploys nascem via webhook.
  O `deploy:audit` checa a **configuração**; o corpo real só aparece em
  _Recent Deliveries_. Se um dia a assinatura passar a falhar, é aqui: o
  content-type mudou de um lado só — troque GitHub **e** Coolify juntos.
- **Falha de deploy não avisa sozinha.** Notificação habilitada não basta: o
  canal precisa de **transporte** configurado (SMTP host+destinatário, token do
  Telegram, URL de webhook…). Com `enabled=t` e transporte vazio, o e-mail simples
  não sai, o build falha, produção fica na versão antiga e ninguém percebe.
  O `deploy:audit` agora falha se nenhum canal de alerta estiver de pé —
  verifique-o antes de confiar na cadeia.

### 7. Se quebrar

| Sintoma                             | Causa provável                          | Ação                                                          |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Push em `main` não gera deploy      | hook inativo ou segredo divergente      | GitHub → Settings → Webhooks → Redeliver; conferir no Coolify |
| `deploy` nasce com origem `manual`  | webhook não foi a fonte (deploy manual) | esperado se alguém disparou à mão; o próximo push corrige     |
| `Invalid signature` em entrega real | segredo trocado no Coolify              | copiar o segredo novo no Coolify e atualizar o hook no GitHub |
| Container `unhealthy` após deploy   | build quebrou                           | ver logs no Coolify; a versão anterior continua no ar         |
| Fila presa (`queued`/`in_progress`) | worker do Coolify travado               | reiniciar o container `coolify`                               |

## Deploy Local (Build no Servidor)

### 1. Via Coolify Dashboard

1. No Coolify, abra a aplicação
2. Clique em **Deploy**
3. Aguarde o build e a inicialização

### 2. Via Docker Compose

```bash
# No servidor
cd /path/to/markdown-studio-live
docker compose down
docker compose build
docker compose up -d
```

### 3. Via Script

```bash
# Usando o script do projeto
./scripts/docker.sh build
./scripts/docker.sh up
```

## Verificação Pós-Deploy

### 1. Health Check

```bash
curl -f http://mkdeditor.appservice.tec.br/ || echo "FAIL"
```

### 2. Headers de Segurança

```bash
curl -sI http://mkdeditor.appservice.tec.br/ | grep -E "X-Content-Type|X-Frame|X-XSS|Referrer|Content-Security"
```

### 3. SPA Fallback

```bash
curl -s -o /dev/null -w "%{http_code}" http://mkdeditor.appservice.tec.br/some/deep/route
# Deve retornar 200
```

### 4. Via Docker

```bash
docker ps | grep markdown-studio
docker logs markdown-studio --tail 20
```

## Troubleshooting

### Container não inicia

```bash
docker logs markdown-studio --tail 50
```

### Erro de Health Check

```bash
docker exec markdown-studio wget -q --spider http://127.0.0.1/ && echo "OK" || echo "FAIL"
```

### Cloudflare Tunnel não rota

1. Verifique se o tunnel está rodando: `docker ps | grep cloudflared`
2. Verifique os logs: `docker logs cloudflared --tail 20`
3. Verifique as routes no Cloudflare Dashboard

### DNS não resolve

1. Verifique se o registro CNAME existe no Cloudflare
2. Aguarde propagação (pode levar até 5 minutos)
3. Teste com `dig mkdeditor.appservice.tec.br`

### Coolify não faz deploy

1. Verifique se o webhook está configurado corretamente
2. Verifique os logs do Coolify: `docker logs coolify --tail 50`
3. Verifique se o GitHub token está válido

## Comandos Úteis

```bash
# Status do container
docker ps | grep markdown-studio

# Logs do container
docker logs markdown-studio -f

# Reiniciar container
docker restart markdown-studio

# Parar container
docker stop markdown-studio

# Remover container
docker rm -f markdown-studio

# Build manual
docker build -t markdown-studio:local .

# Push para GHCR
docker tag markdown-studio:local ghcr.io/hsoservicos/markdown-studio-live:latest
docker push ghcr.io/hsoservicos/markdown-studio-live:latest
```

## Deploy via Coolify CLI

O Coolify possui uma CLI oficial para deploy direto do terminal.

### Instalação

```bash
curl -fsSL https://raw.githubusercontent.com/coollabsio/coolify-cli/main/scripts/install.sh | bash -s -- --user
export PATH="$HOME/.local/bin:$PATH"
```

### Configuração

```bash
# Criar context (substitua <TOKEN> pelo token da API)
coolify context add localhost http://localhost:8000 <TOKEN>

# Verificar conexão
coolify --context localhost context verify
```

### Deploy

```bash
# Listar aplicações
coolify --context localhost resource list

# Deploy por nome
coolify --context localhost deploy name markdown-studio

# Deploy por UUID
coolify --context localhost deploy uuid <application-uuid>
```

Para mais detalhes, veja `docs/how-to/coolify-cli.md`.

## Segurança

- **HTTPS**: Cloudflare handles TLS termination
- **Non-root**: Container roda como UID 1001 (app)
- **Read-only**: Root filesystem read-only (via compose.yaml)
- **Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, CSP, **HSTS** (`max-age=31536000; includeSubDomains`, sem `preload` de propósito)
- **No backend**: 100% client-side, sem dados sensíveis no servidor

## Monitoramento

### Coolify Dashboard

- Status do container
- Logs em tempo real
- Métricas de uso
- Histórico de deploys

### Cloudflare Analytics

- Tráfego por domínio
- Latência
- Erros
- Amostras de requests

## Atualizações

### Via GitHub (Automático)

1. Faça push para o branch `main`
2. O webhook do GitHub (`POST /webhooks/source/github/events/manual`, assinado com
   `X-Hub-Signature-256`) notifica o Coolify
3. O Coolify builda a partir do `Dockerfile` e troca o container (o `:latest` do GHCR é um
   artefato paralelo, não a fonte do deploy)

> Passos manuais de setup do webhook (segredo, rota, branch): ver
> `docs/how-to/docker-workflow.md` — nunca documente o domínio do painel publicamente.

### Via Coolify (Manual)

1. No Coolify, abra a aplicação
2. Clique em **Redeploy**
3. Aguarde o build e a inicialização

### Via Docker (Manual)

```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```
