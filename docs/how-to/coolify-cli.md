# Coolify CLI — Setup e Deploy

Guia para configurar e usar a Coolify CLI para deploy do Markdown-Studio.

## Instalação da CLI

```bash
# Instalar sem sudo
curl -fsSL https://raw.githubusercontent.com/coollabsio/coolify-cli/main/scripts/install.sh | bash -s -- --user

# Adicionar ao PATH (se necessário)
export PATH="$HOME/.local/bin:$PATH"

# Verificar instalação
coolify --help
```

## Configuração

### 1. Criar API Token no Coolify

1. Acesse o Coolify Dashboard: `http://localhost:8000`
2. Vá para **Keys & Tokens** → **API Tokens**
3. Clique em **Create Token**
4. Nome: `cli-deploy`
5. Permissões: **Deploy** + **Read**
6. Clique em **Create**
7. **Copie o token imediatamente** (mostrado apenas uma vez)

### 2. Configurar Context

```bash
# Configurar context para o Coolify local
coolify context add localhost http://localhost:8000 <SEU_TOKEN_AQUI>

# Verificar conexão
coolify --context localhost context verify
```

### 3. Listar Resources

```bash
# Listar todas as aplicações
coolify --context localhost resource list

# Listar projetos
coolify --context localhost project list

# Listar servidores
coolify --context localhost server list
```

## Deploy via CLI

### Opção A: Deploy de Aplicação Existente

```bash
# Listar aplicações
coolify --context localhost app list

# Deploy por nome
coolify --context localhost deploy name markdown-studio

# Deploy por UUID
coolify --context localhost deploy uuid <application-uuid>

# Deploy com force
coolify --context localhost deploy name markdown-studio --force
```

### Opção B: Criar e Deploy Nova Aplicação

```bash
# Listar projetos e servidores
coolify --context localhost project list
coolify --context localhost server list

# Criar aplicação a partir do GitHub
coolify --context localhost app create public \
  --server-uuid <server-uuid> \
  --project-uuid <project-uuid> \
  --environment-name production \
  --git-repository https://github.com/hsoservicos/markdown-studio-live \
  --git-branch main \
  --build-pack dockerfile \
  --ports-exposes 80

# Deploy
coolify --context localhost deploy name <app-name>
```

### Opção C: Deploy via Docker Image

```bash
# Criar aplicação com Docker Image
coolify --context localhost app create public \
  --server-uuid <server-uuid> \
  --project-uuid <project-uuid> \
  --environment-name production \
  --docker-image ghcr.io/hsoservicos/markdown-studio-live:latest \
  --ports-exposes 80

# Deploy
coolify --context localhost deploy name <app-name>
```

## Verificação

```bash
# Verificar status da aplicação
coolify --context localhost app get <application-uuid>

# Ver logs
coolify --context localhost app logs <application-uuid> --lines 50

# Ver deployments
coolify --context localhost deploy list

# Verificar deployment específico
coolify --context localhost deploy get <deployment-uuid>
```

## Comandos Úteis

```bash
# Verificar contexto atual
coolify context list

# Trocar de contexto
coolify context use localhost

# Verificar conexão
coolify context verify

# Ver versão do Coolify
coolify context version

# Formato JSON para scripts
coolify --format json resource list
coolify --format json app list
```

## Exemplo: Deploy Completo

```bash
# 1. Verificar conexão
coolify --context localhost context verify

# 2. Listar recursos
coolify --context localhost resource list

# 3. Deploy
coolify --context localhost deploy name markdown-studio

# 4. Verificar status
coolify --context localhost app get <uuid>

# 5. Ver logs
coolify --context localhost app logs <uuid> --lines 20
```

## Troubleshooting

### Erro 401 Unauthenticated

```bash
# Verificar token
coolify --context localhost context get localhost

# Atualizar token
coolify context set-token localhost <novo-token>

# Verificar conexão
coolify --context localhost context verify
```

### Erro de conexão

```bash
# Verificar se Coolify está rodando
docker ps | grep coolify

# Verificar porta
curl -f http://localhost:8000 || echo "Coolify não está rodando"
```

### Deploy não inicia

```bash
# Verificar logs do Coolify
docker logs coolify --tail 50

# Verificar se o repositório está acessível
curl -f https://github.com/hsoservicos/markdown-studio-live || echo "Repositório inacessível"
```
