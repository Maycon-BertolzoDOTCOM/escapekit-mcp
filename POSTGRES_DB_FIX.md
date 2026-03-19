# PostgreSQL Database Fix - Kiwi TCMS

## Problema Identificado

O usuário reportou um erro **502 Bad Gateway** ao acessar `https://localhost:8443/init-db`.

## Causa Raiz

Analisando os logs do container `kiwi-tcms-escapekit`, foi identificado o seguinte erro:

```
django.db.utils.OperationalError: failed to resolve host 'kiwi-postgres': [Errno -2] Name or service not known
```

### Causas
1. **Container PostgreSQL parado**: O container `kiwi-postgres-escapekit` estava com status `Exited (255) About an hour ago`
2. **Conexão perdida**: O Kiwi TCMS não conseguia conectar ao banco de dados PostgreSQL

## Solução Aplicada

### Passo 1: Iniciar o container PostgreSQL
```bash
docker start kiwi-postgres-escapekit
```

### Passo 2: Verificar que ambos os containers estão rodando
```bash
docker ps | grep kiwi
```

Resultado esperado:
```
3dc26c015aa8   kiwitcms/kiwi:latest   "/bin/sh -c /httpd-f…"   Up 2 minutes (healthy)   0.0.0.0:8443->8443/tcp   kiwi-tcms-escapekit
862dad6c0cf7   postgres:15-alpine     "docker-entrypoint.s…"   Up 5 minutes (healthy)   5432/tcp                kiwi-postgres-escapekit
```

### Passo 3: Reiniciar o container Kiwi TCMS
```bash
docker restart kiwi-tcms-escapekit
```

### Passo 4: Verificar logs
```bash
docker logs kiwi-tcms-escapekit --tail 30
```

Logs esperados:
```
WSGI app 0 (mountpoint='') ready in 20 seconds on interpreter 0x7f3e9c5397d8 pid: 13 (default app)
*** uWSGI is running in multiple interpreter mode ***
spawned uWSGI master process (pid: 13)
spawned uWSGI worker 1 (pid: 21, cores: 1)
spawned uWSGI worker 2 (pid: 22, cores: 1)
spawned uWSGI worker 3 (pid: 23, cores: 1)
spawned uWSGI worker 4 (pid: 24, cores: 1)
[pid: 24|app: 0|req: 1/1] 172.18.0.1 () {56 vars in 983 bytes} GET / => generated 22588 bytes in 1931 msecs (HTTP/1.1 200)
```

## Verificação

### Teste 1: Endpoint /init-db/
```bash
curl -k https://localhost:8443/init-db/
```
**Resultado**: ✅ Página de inicialização retornada com sucesso

### Teste 2: Endpoint XML-RPC Local
```bash
curl -k -X POST -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>' \
  https://localhost:8443/xml-rpc/
```
**Resultado**: ✅ Lista de métodos XML-RPC retornada com sucesso

### Teste 3: Endpoint XML-RPC via Ngrok
```bash
curl -k -X POST -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>' \
  https://paulita-unbreathed-blair.ngrok-free.dev/xml-rpc/
```
**Resultado**: ✅ Lista de métodos XML-RPC retornada com sucesso

## Configuração da Rede Docker

Ambos os containers estão conectados à rede `ralphloopinverso_default`:

```bash
docker network inspect ralphloopinverso_default --format '{{range .Containers}}{{.Name}} {{end}}'
```

Saída:
```
kiwi-tcms-escapekit kiwi-postgres-escapekit
```

Isso permite que o Kiwi TCMS se conecte ao PostgreSQL usando o hostname `kiwi-postgres`.

## Status Atual

- ✅ PostgreSQL rodando (healthy)
- ✅ Kiwi TCMS rodando (healthy)
- ✅ Conexão de rede funcionando
- ✅ Endpoint /init-db/ acessível
- ✅ Endpoint XML-RPC funcionando localmente
- ✅ Endpoint XML-RPC funcionando via ngrok
- ✅ Túnel ngrok ativo e funcionando

## Próximos Passos

1. **Atualizar secret KIWI_URL no GitHub**:
   - URL: `https://github.com/safevisionb-dotcom/escapekit-mcp/settings/secrets/actions`
   - Valor: `https://paulita-unbreathed-blair.ngrok-free.dev`

2. **Executar workflow manualmente**:
   - Ir para: https://github.com/safevisionb-dotcom/escapekit-mcp/actions
   - Selecionar: "Upload Test Results to Kiwi TCMS"
   - Clicar: "Run workflow" → branch: `phase3-ci-cd-test`

3. **Monitorar execução**:
   - Verificar se o step "Upload results to Kiwi TCMS" passa (verde)
   - Se falhar, expandir o step e compartilhar o log completo

4. **Manter ngrok ativo**:
   - Não fechar o terminal onde o ngrok está rodando
   - O ngrok precisa estar online durante a execução do workflow

## Recomendações para Evitar o Problema Futuro

### Solução Permanente 1: docker-compose.yml
Criar um arquivo `docker-compose.yml` para garantir que ambos os containers iniciem juntos:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: kiwi-postgres-escapekit
    networks:
      - ralphloopinverso_default
    restart: always

  kiwi-tcms:
    image: kiwitcms/kiwi:latest
    container_name: kiwi-tcms-escapekit
    ports:
      - "8443:8443"
      - "8080:8080"
    networks:
      - ralphloopinverso_default
    depends_on:
      - postgres
    restart: always

networks:
  ralphloopinverso_default:
    external: true
```

### Solução Permanente 2: Auto-restart policy
Configurar os containers com `restart: always` ou `restart: unless-stopped` para que iniciem automaticamente após reinicialização do sistema.

### Solução Permanente 3: Servidor na nuvem
Como sugerido no documento `NGROK_SETUP_COMPLETE.md`, considerar hospedar o Kiwi TCMS em:
- Oracle Cloud (Free Tier)
- Railway
- Render
- Heroku

Isso eliminaria a necessidade de manter o ngrok ativo localmente.

## Histórico de Commits

- `1eae791` - docs: configuracao completa do ngrok - pronto para testar workflow
- `fe9347a` - docs: analise completa do erro ERR_MODULE_NOT_FOUND
- `262ef20` - fix: remover extensões .js dos imports para resolver ERR_MODULE_NOT_FOUND

## Documentos Relacionados

- `NGROK_SETUP_COMPLETE.md` - Configuração completa do túnel ngrok
- `ERR_MODULE_NOT_FOUND_ANALYSIS.md` - Análise do erro de importação de módulos
- `docker-compose.kiwi.yml` - Configuração docker-compose existente (se aplicável)

---

**Data**: 2026-03-19
**Status**: Resolvido ✅
**Ambiente**: Linux 6.12, Docker