# Correção de Problemas no CI

- [x] Task 1: Configurar cobertura de testes
    - 1.1: Atualizar script "test" no package.json
    - 1.2: Instalar @vitest/coverage-v8
    - 1.3: Configurar vitest.config.ts

- [x] Task 2: Configurar Codecov
    - 2.1: Instruir configuração manual do token (usuário)
    - 2.2: Verificar existência do segredo CODECOV_TOKEN

- [x] Task 3: Atualizar workflows
    - 3.1: Substituir kiwi-upload-enhanced.mts por kiwi-upload-rest.ts
    - 3.2: Adicionar step de upload para Codecov
    - 3.3: Remover arquivo deprecated

- [x] Task 4: Commit e push
    - 4.1: Adicionar alterações
    - 4.2: Criar commit descritivo
    - 4.3: Push para branch main

- [x] Task 5: Verificação final
    - 5.1: Monitorar execução no GitHub Actions
    - 5.2: Confirmar upload para Codecov
    - 5.3: Verificar upload para Kiwi TCMS
