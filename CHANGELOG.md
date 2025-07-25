# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2024-01-15

### Adicionado
- Sistema completo de migração de usuários MySQL
- Interface de linha de comando interativa
- Análise automática da estrutura do banco de dados
- Migração transacional com rollback automático
- Verificação de integridade referencial
- Remoção segura de usuário com backup
- Modo DRY RUN para simulação
- Suite de testes automatizados
- Logs detalhados em formato JSON
- Documentação completa
- Script de instalação automatizada

### Características
- **Análise de Banco**: Identifica automaticamente tabelas com user_id
- **Migração Segura**: Utiliza transações MySQL para garantir consistência
- **Verificação de Integridade**: Confirma que não há referências órfãs
- **Backup Automático**: Cria backup do usuário antes da remoção
- **Interface Amigável**: Menu interativo com confirmações de segurança
- **Relatórios Detalhados**: Logs em JSON para auditoria
- **Testes Automatizados**: Validação de configuração e conectividade

### Segurança
- Validação de pré-requisitos antes de qualquer operação
- Confirmações duplas para operações irreversíveis
- Transações com rollback automático em caso de erro
- Backup obrigatório antes de remoção de dados
- Verificação de integridade referencial

### Arquivos Principais
- `index.js`: Interface CLI principal
- `migrate.js`: Script de migração de dados
- `remove-user.js`: Remoção segura de usuário
- `analyze-database.js`: Análise da estrutura do banco
- `test.js`: Suite de testes
- `config/database.js`: Configuração de conexão MySQL

### Dependências
- `mysql2`: ^3.6.5 - Driver MySQL para Node.js
- `dotenv`: ^16.3.1 - Gerenciamento de variáveis de ambiente
- `chalk`: ^4.1.2 - Formatação colorida do terminal

### Requisitos do Sistema
- Node.js >= 20.0.0
- npm >= 10.0.0
- MySQL com acesso ao banco fiesto18_database
- Usuários com IDs 41 e 358 existentes no banco

### Scripts Disponíveis
- `npm start`: Inicia interface CLI
- `npm test`: Executa testes
- `npm run analyze`: Analisa estrutura do banco
- `npm run migrate`: Executa migração
- `npm run remove`: Remove usuário origem
- `npm run dry-run`: Executa migração em modo simulação

### Configuração
- Arquivo `.env` para configurações de banco
- Suporte a modo DRY RUN
- Configuração de timeouts e pool de conexões
- Logs configuráveis por nível

### Documentação
- README.md completo com instruções detalhadas
- Exemplos de uso e configuração
- Guia de solução de problemas
- Documentação de API interna

---

## Formato das Versões

- **MAJOR**: Mudanças incompatíveis na API
- **MINOR**: Funcionalidades adicionadas de forma compatível
- **PATCH**: Correções de bugs compatíveis

## Tipos de Mudanças

- **Adicionado**: para novas funcionalidades
- **Alterado**: para mudanças em funcionalidades existentes
- **Descontinuado**: para funcionalidades que serão removidas
- **Removido**: para funcionalidades removidas
- **Corrigido**: para correções de bugs
- **Segurança**: para vulnerabilidades corrigidas

