# Bugfix Requirements Document

## Introduction

O workflow de CI do EscapeKit falha com `exit code 1` em todas as versões do Node.js (18.x, 20.x, 22.x) durante a etapa de testes, impedindo a conclusão do pipeline. A causa raiz é que `vitest --coverage` é executado sem a flag `--run`, fazendo o processo entrar em modo watch e nunca terminar — o CI interpreta isso como falha. Adicionalmente, 133 warnings de lint impedem a adoção futura de `--max-warnings 0`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o CI executa `npm run test:coverage` (que chama `vitest --coverage`) THEN o processo entra em modo watch interativo e nunca termina, resultando em `exit code 1` por timeout ou cancelamento

1.2 WHEN o CI executa `npm test` no job `kiwi-upload` (que chama `vitest --coverage`) THEN o mesmo comportamento de modo watch ocorre, bloqueando o job

1.3 WHEN o Codecov tenta fazer upload após a falha dos testes THEN não encontra o arquivo `coverage/coverage-final.json` porque a cobertura nunca foi gerada

1.4 WHEN o CI executa `npm run lint` THEN o comando retorna com 133 warnings dos tipos `no-useless-escape`, `no-control-regex`, `@typescript-eslint/no-explicit-any` e `@typescript-eslint/no-non-null-assertion`, impedindo a configuração de `--max-warnings 0` no futuro

### Expected Behavior (Correct)

2.1 WHEN o CI executa `npm run test:coverage` THEN o processo SHALL executar os testes uma única vez, gerar o relatório de cobertura e terminar com `exit code 0`

2.2 WHEN o CI executa `npm test` no job `kiwi-upload` THEN o processo SHALL executar os testes uma única vez e terminar com `exit code 0`

2.3 WHEN os testes passam com sucesso THEN o Codecov SHALL encontrar o arquivo `coverage/coverage-final.json` e fazer o upload corretamente

2.4 WHEN o CI executa `npm run lint` THEN o comando SHALL retornar zero warnings, permitindo a adição de `--max-warnings 0` ao workflow

### Unchanged Behavior (Regression Prevention)

3.1 WHEN um desenvolvedor executa `npm test` localmente sem flags adicionais THEN o sistema SHALL CONTINUE TO iniciar o vitest em modo watch para desenvolvimento interativo

3.2 WHEN os testes são executados THEN o sistema SHALL CONTINUE TO gerar relatórios de cobertura nos formatos `text`, `json` e `html`

3.3 WHEN o CI executa o build (`tsc`) THEN o sistema SHALL CONTINUE TO compilar sem erros

3.4 WHEN o CI executa o typecheck (`tsc --noEmit`) THEN o sistema SHALL CONTINUE TO passar sem erros de tipo

3.5 WHEN os 133 warnings de lint são corrigidos THEN o sistema SHALL CONTINUE TO respeitar todas as regras de lint configuradas como `error` (ex.: `@typescript-eslint/no-unused-vars`, `no-restricted-imports`)

3.6 WHEN a lógica dos adaptadores, parsers e demais módulos é mantida THEN o sistema SHALL CONTINUE TO passar nos 1141 testes existentes

---

## Bug Condition (Pseudocódigo)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CICommand
  OUTPUT: boolean

  // Retorna true quando o comando de teste é executado sem --run em ambiente não-interativo
  RETURN X.command CONTAINS "vitest" AND NOT X.args CONTAINS "--run" AND X.env = "CI"
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← runCICommand'(X)
  ASSERT result.exitCode = 0 AND result.terminated = true AND result.coverageGenerated = true
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT runCICommand(X) = runCICommand'(X)
END FOR
```
