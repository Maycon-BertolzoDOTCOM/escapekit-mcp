# Correção de Problemas no CI

## Requisitos
1. Configurar cobertura de testes com Vitest e Codecov
2. Atualizar script de upload para Kiwi TCMS (kiwi-upload-rest.ts)

## Arquitetura
1. **Cobertura de Testes**
   - Configurar Vitest para gerar relatórios
   - Integrar com Codecov via GitHub Actions
   - Gerenciar token de segurança

2. **Upload para Kiwi TCMS**
   - Substituir referências ao script antigo
   - Remover workflow deprecated
   - Garantir compatibilidade com o novo script REST

## Arquivos Afetados
- `package.json` (modificação)
- `vitest.config.ts` (criação/modificação)
- `.github/workflows/ci.yml` (modificação)
- `.github/workflows/kiwi-tcms.yml.deprecated` (remoção)

## Implementação
### Cobertura de Testes
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov']
    }
  }
});
```

### Workflow CI
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    file: ./coverage/coverage-final.json
```

## Fluxo Esperado
1. Testes geram relatório de cobertura
2. Codecov processa e exibe resultados
3. Upload para Kiwi TCMS usa novo script

## Verificações
- Token do Codecov configurado
- Relatórios gerados no diretório coverage/
- Script antigo removido dos workflows