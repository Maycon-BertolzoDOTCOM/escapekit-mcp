# Requisitos — Variáveis de Ambiente Seguras

## Introdução

O arquivo `backend/.env` contém a chave real do WaveSpeedAI e está no repositório. Isso é um risco de segurança — qualquer pessoa com acesso ao repo tem acesso à chave.

## Requisitos

### Requisito 1: Remover segredos do repositório

**User Story:** Como operador, quero que nenhuma chave de API esteja no repositório Git.

#### Critérios de Aceitação

1. THE arquivo `backend/.env` SHALL ser removido do histórico Git ou ter seus valores substituídos por placeholders
2. THE arquivo `backend/.env` SHALL estar listado no `.gitignore`
3. THE repositório SHALL conter `backend/.env.example` com todas as variáveis e valores placeholder
4. WHEN o sistema inicia sem uma variável obrigatória, THE sistema SHALL falhar com mensagem clara indicando qual variável está faltando

### Requisito 2: Rotação da chave WaveSpeedAI

**User Story:** Como operador, quero rotacionar a chave WaveSpeedAI que foi exposta.

#### Critérios de Aceitação

1. THE chave `c991efe84cdc51b48e213c37392090a643c46d609cf67090f518b0c86d1a014e` SHALL ser revogada e substituída por uma nova
2. THE nova chave SHALL ser configurada apenas nas variáveis de ambiente da plataforma (Railway), nunca em arquivo
