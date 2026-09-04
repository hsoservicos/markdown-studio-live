# Guia Completo: Deploy do Markdown-Studio no Coolify

Passo a passo para criar, configurar e deployar o Markdown-Studio no Coolify.

## Pré-requisitos

- [x] Coolify rodando (v4.3.16+)
- [x] GitHub repository `hsoservicos/markdown-studio-live` (branch `main`)
- [x] Cloudflare Tunnel configurado
- [x] Domínio `mkdeditor.appservice.tec.br`

## Passo 1: Criar Novo Resource

1. Acesse o **Coolify Dashboard**: `http://localhost:8000`
2. Clique em **New Resource** (canto superior direito)
3. Selecione **Application**
4. Escolha **Git Source**

## Passo 2: Configurar Fonte do Código

### 2.1 Autorizar GitHub

1. Selecione **GitHub App** (recomendado) ou **Deploy Key**
2. Selecione o repositório: `hsoservicos/markdown-studio-live`
3. Autorize o Coolify a acessar o repositório

### 2.2 Configurar Branch

| Campo              | Valor                              |
| ------------------ | ---------------------------------- |
| **Repository**     | `hsoservicos/markdown-studio-live` |
| **Branch**         | `main`                             |
| **Base Directory** | `/`                                |

⚠️ **IMPORTANTE**: Use `main`, não `master`!

## Passo 3: Escolher Build Pack

**Este é o passo mais importante!**

1. Na tela de seleção de Build Pack, clique em **Nixpacks**
2. Altere para **Dockerfile** no dropdown
3. Configure:

| Campo                   | Valor          |
| ----------------------- | -------------- |
| **Build Pack**          | **Dockerfile** |
| **Dockerfile Location** | `./Dockerfile` |
| **Base Directory**      | `/`            |

⚠️ **NÃO use Nixpacks** — ele instala Node 18 EOL e não usa nosso Dockerfile multi-stage!

## Passo 4: Configurar Network

| Campo        | Valor                         |
| ------------ | ----------------------------- |
| **Port**     | `80`                          |
| **Domain**   | `mkdeditor.appservice.tec.br` |
| **Protocol** | `HTTP`                        |

⚠️ **IMPORTANTE**: Use `HTTP`, não `HTTPS` — o Cloudflare lida com HTTPS!

## Passo 5: Configurar Variáveis de Ambiente

Nenhuma variável de ambiente necessária. O app é 100% client-side.

## Passo 6: Configurar Health Check

| Campo                 | Valor |
| --------------------- | ----- |
| **Health Check Path** | `/`   |
| **Interval**          | `30s` |
| **Timeout**           | `3s`  |
| **Start Period**      | `5s`  |
| **Retries**           | `3`   |

## Passo 7: Configurar Recursos

| Campo            | Valor   |
| ---------------- | ------- |
| **Memory Limit** | `128MB` |
| **CPU Limit**    | `0.5`   |

## Passo 8: Deploy

1. Clique em **Deploy**
2. Aguarde o build (aproximadamente 2-3 minutos)
3. Verifique se o health check passa

## Passo 9: Verificar Deploy

### 9.1 Status no Coolify

- Status deve mostrar **Running**
- Health check deve estar **Healthy**

### 9.2 Testar via Browser

1. Acesse `http://mkdeditor.appservice.tec.br`
2. Verifique se o editor carrega
3. Teste as funcionalidades básicas

### 9.3 Testar via Terminal

```bash
# Health check
curl -f http://mkdeditor.appservice.tec.br/ || echo "FAIL"

# Headers de segurança
curl -sI http://mkdeditor.appservice.tec.br/ | grep -E "X-Content-Type|X-Frame|CSP"

# SPA fallback
curl -s -o /dev/null -w "%{http_code}" http://mkdeditor.appservice.tec.br/some/route
```

### 10.2 Configurar Cloudflare Tunnel

Se ainda não estiver configurado:

1. No **Cloudflare Dashboard** → **Zero Trust** → **Networks** → **Tunnels**
2. Selecione o tunnel existente ou crie um novo
3. Clique em **Add route**

| Campo           | Valor                 |
| --------------- | --------------------- |
| **Subdomain**   | `mkdeditor`           |
| **Domain**      | `appservice.tec.br`   |
| **Path**        | (vazio)               |
| **Service URL** | `http://localhost:80` |

Após preencher, clique em **Add route**.

## Troubleshooting

### Erro: "Remote branch main not found"

**Causa**: Coolify tentando clonar branch `main` mas repositório usa `master`

**Solução**: Verificar se a branch está correta em **Configuration** → **Git Source**

### Erro: "NIXPACKS_NODE_VERSION not set"

**Causa**: Coolify usando Nixpacks em vez de Dockerfile

**Solução**: Alterar **Build Pack** de Nixpacks para **Dockerfile**

### Erro: "Health check failed"

**Causa**: Container não inicia corretamente

**Verificar**:

1. Logs do container no Coolify
2. Se o Dockerfile está correto
3. Se a porta 80 está exposta

### Erro: "Container restarting"

**Causa**: Entrypoint/CMD incorretos

**Verificar**:

1. Se o Build Pack é **Dockerfile** (não Nixpacks)
2. Se o Dockerfile Location está correto (`./Dockerfile`)

## Comandos Úteis

```bash
# Verificar status do container
docker ps | grep <app-name>

# Ver logs
docker logs <container-name> --tail 50

# Reiniciar
docker restart <container-name>

# Parar
docker stop <container-name>

# Remover
docker rm -f <container-name>
```

## Configuração Recomendada

| Campo                   | Valor Recomendado             |
| ----------------------- | ----------------------------- |
| **Build Pack**          | Dockerfile                    |
| **Dockerfile Location** | `./Dockerfile`                |
| **Base Directory**      | `/`                           |
| **Port**                | `80`                          |
| **Domain**              | `mkdeditor.appservice.tec.br` |
| **Protocol**            | HTTP                          |
| **Branch**              | `main`                        |
| **Memory**              | 128MB                         |
| **CPU**                 | 0.5                           |

## Checklist de Deploy

- [ ] Coolify acessível em `http://localhost:8000`
- [ ] GitHub repository acessível
- [ ] Branch `main` existe no repositório
- [ ] Build Pack configurado como **Dockerfile**
- [ ] Dockerfile Location: `./Dockerfile`
- [ ] Port: `80`
- [ ] Domain: `mkdeditor.appservice.tec.br`
- [ ] Protocol: `HTTP`
- [ ] Cloudflare Tunnel configurado
- [ ] Deploy concluído com sucesso
- [ ] Health check passando
- [ ] Aplicação acessível via browser
