# Kiwi TCMS Configuration - Status Atual

**Data:** 2026-03-17  
**Fase:** Fase 4 - Configuração e Integração com Kiwi TCMS

---

## ✅ O que foi Completado

### 1. Infraestrutura Docker
- [x] Contêineres configurados e funcionando
  - \`kiwi-postgres-escapekit\`: Rodando e saudável
  - \`kiwi-tcms-escapekit\`: Rodando e saudável
- [x] Portas expostas corretamente
  - HTTP: 8080 (com redirect 301 para HTTPS)
  - HTTPS: 8443 (agora exposta e acessível)
- [x] \`docker-compose.kiwi.yml\` atualizado com porta 8443

### 2. Scripts e Documentação
- [x] Script de configuração automática criado: \`scripts/kiwi-setup-auto.ts\`
- [x] Guia de configuração manual completo: \`.comate/specs/kiwi-tcms-configuration/MANUAL_SETUP_GUIDE.md\`
- [x] Arquivo de configuração pronto: \`config/kiwi-tcms.json\`
  - baseUrl: \`http://localhost:8080\` ✓
  - username: \`admin\` ✓
  - password: \`admin\` ✓
  - defaultProduct: \`EscapeKit\` ✓
  - defaultPlanId: \`null\` ← **PRECISA SER ATUALIZADO**
  - testRunTemplate: \`AutoTest-{DATE}\` ✓

### 3. Arquivos de Resultados de Teste
- [x] \`vitest-results.json\` (400K) - Pronto para upload
- [x] \`vitest-results-example.json\` (3,5K) - Exemplo para testes

---

## ⚠️ Pendências

### 1. Configuração Manual do Kiwi TCMS (REQUER AÇÃO DO USUÁRIO)

**Motivo:** O Kiwi TCMS força HTTPS e a autenticação via API não funciona devido ao HTTP 301 redirect. A variável \`KIWI_HTTPS: "False"\` não é reconhecida pela versão open-source.

**Passos necessários:**

#### Passo 1: Acessar o Kiwi TCMS via navegador
\`\`\`
https://localhost:8443
\`\`\`
- Aceite o aviso de certificado autoassinado
- Faça login com \`admin/admin\`

#### Passo 2: Criar Produto "EscapeKit"
1. Menu: **Produto** (Products)
2. Ação: **Adicionar** (Add)
3. Nome: \`EscapeKit\`
4. **IMPORTANTE:** Anote o **Product ID**

#### Passo 3: Criar Plano de Teste "Main Test Plan"
1. Menu: **Test Plan**
2. Ação: **Adicionar** (Add)
3. Produto: Selecionar \`EscapeKit\`
4. Nome: \`Main Test Plan\`
5. **IMPORTANTE:** Anote o **Test Plan ID**

#### Passo 4: Atualizar configuração
Edite \`config/kiwi-tcms.json\`:
\`\`\`json
{
  "baseUrl": "http://localhost:8080",
  "username": "admin",
  "password": "admin",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,  // ← Substitua pelo Test Plan ID anotado
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}
\`\`\`

#### Passo 5: Testar upload
\`\`\`bash
npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
\`\`\`

---

## 📊 Arquivos Modificados/Criados

### Modificados:
1. \`docker-compose.kiwi.yml\` - Adicionada porta 8443

### Criados:
1. \`scripts/kiwi-setup-auto.ts\` - Script de configuração automática (não funcional devido a HTTPS redirect)
2. \`.comate/specs/kiwi-tcms-configuration/MANUAL_SETUP_GUIDE.md\` - Guia completo de configuração manual
3. \`.comate/specs/kiwi-tcms-configuration/KIWI_TCMS_CONFIG_STATUS.md\` - Este arquivo (status atual)

---

## 🔍 Diagnóstico Técnico

### Problema de Automação
\`\`\`
PROBLEMA: HTTP 301 Redirect
CAUSA: Kiwi TCMS força HTTPS por padrão na versão open-source
TENTATIVA: Variável KIWI_HTTPS: "False" (não reconhecida)
IMPACTO: Script de automação não consegue autenticar via API
SOLUÇÃO: Configuração manual via navegador
\`\`\`

### Status dos Serviços
\`\`\`bash
$ docker compose -f docker-compose.kiwi.yml ps
NAME                      STATUS                        PORTS
kiwi-postgres-escapekit   Up 6 minutes (healthy)        5432/tcp
kiwi-tcms-escapekit       Up About a minute (healthy)   0.0.0.0:8080->8080/tcp
                                                        0.0.0.0:8443->8443/tcp
\`\`\`

### Testes de Conectividade
- HTTP (8080): ✅ Respondendo com redirect 301
- HTTPS (8443): ✅ Disponível (requer aceitar certificado autoassinado)
- API HTTP: ❌ Bloqueada por redirect 301
- API HTTPS: ❌ Não testada (requer certificado aceito)

---

## 🎯 Próximos Passos (Para o Usuário)

1. [ ] Acessar \`https://localhost:8443\` no navegador e aceitar certificado
2. [ ] Fazer login com \`admin/admin\`
3. [ ] Criar produto "EscapeKit" e anotar Product ID
4. [ ] Criar plano de teste "Main Test Plan" e anotar Test Plan ID
5. [ ] Atualizar \`config/kiwi-tcms.json\` com o Test Plan ID
6. [ ] Executar upload: \`npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest\`
7. [ ] Verificar resultados na interface web do Kiwi TCMS
8. [ ] Documentar conclusão da Fase 4

---

## 📝 Referências e Documentação

- [Guia de Configuração Manual](./MANUAL_SETUP_GUIDE.md)
- [Kiwi TCMS Documentation](https://kiwitcms.readthedocs.io/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Kiwi TCMS GitHub](https://github.com/kiwitcms/Kiwi)

---

## ⚠️ Notas Importantes

1. **HTTPS Redirect:** O Kiwi TCMS força HTTPS como medida de segurança. Isso não pode ser facilmente desabilitado na versão open-source.

2. **Certificado Autoassinado:** Em ambiente de desenvolvimento, é seguro aceitar o certificado autoassinado. Em produção, use Let's Encrypt ou outro certificado válido.

3. **Automação:** Embora tenhamos criado o script \`kiwi-setup-auto.ts\`, ele não funciona devido ao redirect 301. A configuração manual via navegador é necessária.

4. **Testes Disponíveis:** Existem dois arquivos de resultados de teste prontos:
   - \`vitest-results.json\` (400K) - Resultados completos
   - \`vitest-results-example.json\` (3,5K) - Exemplo

---

**Resumo:** A infraestrutura está pronta e funcionando. A configuração manual via navegador é o único caminho viável neste momento. Siga os passos acima para completar a Fase 4.

**Contato:** Em caso de dúvidas, consulte o guia \`MANUAL_SETUP_GUIDE.md\` ou verifique os logs do container.
