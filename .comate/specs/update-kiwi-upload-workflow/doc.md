# Atualização do Workflow para kiwi-upload-rest

## Requisito
Atualizar o pipeline do GitLab CI para usar o novo script `kiwi-upload-rest.ts` em vez do antigo `kiwi-upload.ts`.

## Arquitetura e Abordagem
1. Localizar todas as referências a `kiwi-upload.ts` no `.gitlab-ci.yml`
2. Substituir por `kiwi-upload-rest.ts` mantendo os mesmos parâmetros
3. Verificar se os parâmetros existentes são compatíveis com o novo script
4. Garantir que as variáveis de ambiente necessárias (KIWI_PRODUCT_ID, KIWI_TEST_PLAN_ID) continuem disponíveis

## Arquivos Afetados
- `.gitlab-ci.yml` (modificação)

## Detalhes de Implementação
```yaml
# Antigo
npx ts-node scripts/kiwi-upload.ts

# Novo
npx tsx scripts/kiwi-upload-rest.ts
```

## Condições de Contorno
- O novo script deve estar disponível em `scripts/kiwi-upload-rest.ts`
- As variáveis de ambiente devem ser mantidas
- O formato do arquivo de resultados (vitest-results.json) deve ser compatível

## Fluxo de Dados
1. Pipeline executa testes
2. Gera arquivo de resultados
3. Upload via novo script REST

## Resultados Esperados
- Pipeline continua funcionando normalmente
- Upload de resultados via novo endpoint REST