# Atualizar Workflow para kiwi-upload-rest

- [x] Task 1: Atualizar job principal de upload
    - 1.1: Substituir `kiwi-upload.ts` por `kiwi-upload-rest.ts`
    - 1.2: Atualizar comando `ts-node` para `tsx`
    - 1.3: Verificar parâmetros mantidos

- [x] Task 2: Atualizar job manual de upload
    - 2.1: Mesmas substituições do job principal
    - 2.2: Garantir que continua funcionando como manual

- [x] Task 3: Atualizar job de report
    - 3.1: Substituir script no dry-run
    - 3.2: Verificar saída do report

- [x] Task 4: Testar pipeline localmente
    - 4.1: Executar `npx tsx scripts/kiwi-upload-rest.ts --help` (done)
    - 4.2: Verificar conexão com API REST (done)
