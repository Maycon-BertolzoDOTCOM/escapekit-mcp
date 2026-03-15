# 📦 Guia de Publicação no npm

Este guia descreve o processo completo para publicar a CLI `qwen-escapekit` no npm.

---

## ✅ Pré-requisitos

### 1. Conta no npm

- Crie uma conta em [npmjs.com](https://www.npmjs.com/signup)
- Verifique seu e-mail

### 2. Login no npm

```bash
npm login
```

Isso abrirá um prompt para:
- Username
- Password
- Email

### 3. Verificar nome disponível

```bash
npm view qwen-escapekit
```

Se retornar `npm ERR! code E404`, o nome está disponível.

---

## 🚀 Processo de Publicação

### Passo 1: Preparação

Execute o script de preparação:

```bash
cd qwen-escapekit
./prepublish.sh
```

Este script automaticamente:
- [x] Instala dependências
- [x] Executa lint
- [x] Executa typecheck
- [x] Roda testes
- [x] Faz build
- [x] Verifica versão no npm

### Passo 2: Revisão Final

Verifique os arquivos que serão publicados:

```bash
# Veja o que será incluído
npm pack --dry-run

# Ou liste arquivos manualmente
ls -la dist/
cat package.json | grep -A 10 '"files"'
```

### Passo 3: Publicação Manual (Primeira Vez)

```bash
# Navegue até o diretório
cd qwen-escapekit

# Publique como beta (recomendado para primeira versão)
npm publish --access public --tag beta

# Ou publique como estável
npm publish --access public
```

### Passo 4: Verificar Publicação

```bash
# Verifique no npmjs.com
npm view qwen-escapekit

# Ou acesse
https://www.npmjs.com/package/qwen-escapekit
```

### Passo 5: Testar Instalação

```bash
# Em um diretório temporário
cd /tmp
npm install -g qwen-escapekit
qwen-escapekit --version
qwen-escapekit --help
```

---

## 🔄 Publicação Automática (GitHub Actions)

### Configurar Secrets

No GitHub, vá para:
`Settings > Secrets and variables > Actions`

Adicione:
- `NPM_TOKEN`: Seu token do npm (obtido em https://www.npmjs.com/settings/YOUR_USERNAME/tokens)

### Criar Tag e Publicar

```bash
# Atualize a versão no package.json
npm version 0.1.0-beta.1

# Isso cria uma tag automaticamente
git push --tags

# O GitHub Actions detectará a tag e publicará automaticamente
```

### Formato de Tags

- Beta: `qwen-escapekit/v0.1.0-beta.1`
- Estável: `qwen-escapekit/v0.1.0`
- Release Candidate: `qwen-escapekit/v0.1.0-rc.1`

---

## 📋 Versionamento Semântico

Seguimos [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │      │     │
  │      │     └─ Bug fixes (compatível)
  │      └─ Novas features (compatível)
  └─ Mudanças breaking (incompatível)
```

### Comandos npm

```bash
# Patch: 0.1.0 → 0.1.1
npm version patch

# Minor: 0.1.0 → 0.2.0
npm version minor

# Major: 0.1.0 → 1.0.0
npm version major

# Pre-release: 0.1.0 → 0.1.1-beta.0
npm version prerelease --preid=beta
```

---

## 🧪 Testes Antes de Publicar

### Teste Local com npm pack

```bash
# Crie um pacote .tgz local
npm pack

# Isso cria: qwen-escapekit-0.1.0-beta.1.tgz

# Instale localmente para testar
npm install -g ./qwen-escapekit-*.tgz

# Teste
qwen-escapekit --version
qwen-escapekit paper --help
```

### Checklist de Testes

- [ ] `qwen-escapekit --version` funciona
- [ ] `qwen-escapekit --help` funciona
- [ ] `qwen-escapekit paper --help` funciona
- [ ] `qwen-escapekit list --help` funciona
- [ ] `qwen-escapekit implement --help` funciona
- [ ] `qwen-escapekit validate --help` funciona
- [ ] `qwen-escapekit stats --help` funciona

---

## 📊 Pós-Publicação

### Atualizar README Principal

No README do projeto principal (`../README.md`):

```markdown
### `qwen-escapekit` CLI

```bash
npm install -g qwen-escapekit
qwen-escapekit paper 10.48550/arXiv.2603.10163
```

[![npm version](https://img.shields.io/npm/v/qwen-escapekit.svg)](https://www.npmjs.com/package/qwen-escapekit)
```

### Anunciar

1. **GitHub**: Crie um Release com changelog
2. **Comunidades**:
   - Reddit: r/programming, r/opensource, r/ChatGPT
   - Discord: Cursor, AI Dev Tools
   - Twitter/X: Post com #opensource #AI #CLI
3. **Documentação**: Atualize CHANGELOG.md

### Monitorar

```bash
# Ver downloads
npm view qwen-escapekit downloads

# Ver versões
npm view qwen-escapekit versions

# Ver maintainers
npm owner ls qwen-escapekit
```

---

## 🐛 Problemas Comuns

### "npm ERR! 403 Forbidden"

**Causa**: Nome já existe ou sem permissão.

**Solução**:
```bash
# Verifique se o nome existe
npm view qwen-escapekit

# Se existir, escolha outro nome ou use scope
# No package.json:
"name": "@escapekit/qwen-cli"

# Publique com scope
npm publish --access public
```

### "npm ERR! 402 Payment Required"

**Causa**: Tentando publicar pacote privado sem pagar.

**Solução**:
```bash
# Publique como público
npm publish --access public
```

### "npm ERR! You must sign up for private organizations"

**Causa**: Scope não configurado.

**Solução**:
```bash
# Crie organização no npmjs.com
# Ou use scope pessoal
npm publish --scope=seu-username
```

### Build falha após publicação

**Causa**: Arquivos de build não incluídos.

**Solução**:
```bash
# Verifique package.json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]

# Rebuild e republicação
npm run build
npm publish
```

---

## 📈 Métricas de Sucesso

Após publicação, monitore:

| Métrica | Meta (30 dias) |
|---------|----------------|
| Downloads | 100+ |
| Stars no GitHub | 20+ |
| Issues reportadas | < 5 |
| Tempo de resposta | < 48h |

### Comandos para Verificar

```bash
# Downloads semanais
npm view qwen-escapekit downloads

# Dependents (quem usa seu pacote)
npm view qwen-escapekit dependents

# Stars no GitHub
gh api repos/escapekit/escapekit-mcp | jq .stargazers_count
```

---

## 🎯 Checklist de Publicação

### Antes de Publicar

- [ ] Testes passando (`npm test`)
- [ ] Build funcionando (`npm run build`)
- [ ] Lint limpo (`npm run lint`)
- [ ] Typecheck OK (`npm run typecheck`)
- [ ] package.json atualizado (versão, metadata)
- [ ] README com badges
- [ ] LICENSE incluído
- [ ] .npmignore configurado (se necessário)
- [ ] Changelog atualizado

### Publicação

- [ ] `npm login` realizado
- [ ] `./prepublish.sh` executado
- [ ] `npm publish --access public` executado
- [ ] Pacote verificado no npmjs.com
- [ ] Instalação global testada

### Pós-Publicação

- [ ] Tag git criada (`git tag v0.1.0-beta.1`)
- [ ] Tags pushadas (`git push --tags`)
- [ ] Release no GitHub criado
- [ ] README principal atualizado
- [ ] Comunidades anunciadas
- [ ] Métricas monitoradas

---

## 📚 Recursos Adicionais

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions for npm](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [npm Publishing Best Practices](https://blog.npmjs.org/post/166086616795/best-practices-for-publishing-on-npm)

---

## 🚀 Publicação Rápida (Resumo)

```bash
# 1. Login
npm login

# 2. Preparar
cd qwen-escapekit
./prepublish.sh

# 3. Publicar
npm publish --access public

# 4. Verificar
npm view qwen-escapekit

# 5. Tag
git tag v0.1.0-beta.1
git push --tags
```

---

**Status**: ✅ **Pronto para publicação!**

**Próximo Passo**: Executar `./prepublish.sh` e depois `npm publish --access public`
