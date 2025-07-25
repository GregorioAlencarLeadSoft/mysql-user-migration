# Migração de Usuário MySQL - Projeto Node.js

## Visão Geral

Este projeto Node.js foi desenvolvido para realizar a migração completa de dados do usuário usando ID no banco de dados MySQL. O sistema garante integridade referencial e oferece remoção segura do usuário origem após a migração bem-sucedida.

## Características Principais

### 🔄 Migração Completa de Dados
- Identifica automaticamente todas as tabelas que referenciam `user_id`
- Migra todos os registros relacionais do usuário origem para o destino
- Utiliza transações para garantir consistência dos dados
- Suporte a modo DRY RUN para simulação segura

### 🛡️ Segurança e Integridade
- Verificação de integridade referencial antes da remoção
- Backup automático do usuário antes da exclusão
- Transações com rollback automático em caso de erro
- Logs detalhados de todas as operações

### 📊 Análise e Relatórios
- Análise completa da estrutura do banco de dados
- Identificação de chaves estrangeiras e relacionamentos
- Relatórios detalhados em formato JSON
- Contagem de registros por tabela

### 🖥️ Interface Amigável
- Interface de linha de comando interativa
- Menu com opções claras e confirmações de segurança
- Feedback visual com cores e ícones
- Processo passo-a-passo ou execução completa

## Estrutura do Projeto

```
mysql-user-migration/
├── config/
│   └── database.js          # Configuração de conexão MySQL
├── analyze-database.js      # Análise da estrutura do banco
├── migrate.js              # Script principal de migração
├── remove-user.js          # Remoção segura do usuário
├── index.js               # Interface CLI principal
├── test.js                # Suite de testes
├── package.json           # Dependências e scripts
├── .env.example          # Exemplo de configuração
└── README.md             # Esta documentação
```

## Pré-requisitos

### Software Necessário
- **Node.js**: versão 20.0.0 ou superior
- **npm**: versão 10.0.0 ou superior
- **MySQL**: acesso ao banco `fiesto18_database`

### Dependências do Projeto
- `mysql2`: Driver MySQL para Node.js
- `dotenv`: Gerenciamento de variáveis de ambiente
- `chalk`: Formatação colorida do terminal

## Instalação e Configuração

### 1. Clonar ou Baixar o Projeto
```bash
# Se usando Git
git clone <repository-url>
cd mysql-user-migration

# Ou extrair o arquivo ZIP baixado
unzip mysql-user-migration.zip
cd mysql-user-migration
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

### 4. Configuração do Arquivo .env
```env
# Configurações do Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=fiesto18_database

# IDs dos usuários para migração
SOURCE_USER_ID=41
TARGET_USER_ID=358

# Configurações de log
LOG_LEVEL=info
DRY_RUN=false
```

## Uso do Sistema

### Interface de Linha de Comando
```bash
# Executar interface principal
npm start
# ou
node index.js
```

### Opções Disponíveis

#### 1. Testar Conexão com Banco de Dados
Verifica se a conexão com o MySQL está funcionando corretamente.

#### 2. Analisar Estrutura do Banco
- Identifica todas as tabelas com colunas `user_id`
- Conta registros por tabela para o usuário origem
- Gera relatório detalhado em JSON

#### 3. Executar Migração de Dados
- Migra todos os dados do usuário 41 para 358
- Utiliza transações para garantir consistência
- Gera logs detalhados do processo

#### 4. Remover Usuário Origem
- Verifica se é seguro remover o usuário
- Cria backup antes da remoção
- Remove o usuário da tabela principal

#### 5. Processo Completo
Executa todas as etapas em sequência:
1. Análise do banco
2. Migração de dados
3. Verificação de integridade
4. Remoção do usuário origem

### Execução Individual de Scripts

#### Análise do Banco
```bash
node analyze-database.js
```

#### Migração de Dados
```bash
node migrate.js
```

#### Remoção de Usuário
```bash
node remove-user.js
```

#### Testes
```bash
npm test
# ou
node test.js
```

## Modo DRY RUN

Para testar o sistema sem fazer alterações reais:

```bash
# Definir no .env
DRY_RUN=true

# Ou via variável de ambiente
DRY_RUN=true npm start
```

No modo DRY RUN:
- Nenhuma alteração é feita no banco
- Todas as operações são simuladas
- Logs mostram o que seria executado
- Ideal para validação antes da execução real

## Logs e Relatórios

### Arquivos Gerados

#### Análise do Banco
- `database-analysis-report.json`: Estrutura completa do banco

#### Migração
- `migration-log-[timestamp].json`: Log detalhado da migração

#### Remoção
- `removal-log-[timestamp].json`: Log da remoção do usuário
- `user-backup-[user_id]-[timestamp].json`: Backup do usuário

#### Testes
- `test-report-[timestamp].json`: Resultados dos testes

### Exemplo de Log de Migração
```json
{
  "sourceUserId": 41,
  "targetUserId": 358,
  "dryRun": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "log": [
    {
      "timestamp": "2024-01-15T10:30:01.000Z",
      "level": "info",
      "message": "Iniciando migração",
      "data": null
    }
  ]
}
```

## Segurança e Boas Práticas

### Verificações de Segurança
1. **Validação de Pré-requisitos**: Confirma existência dos usuários
2. **Verificação de Integridade**: Analisa referências antes da remoção
3. **Transações**: Garante consistência ou rollback completo
4. **Backups**: Cria backup antes de qualquer remoção

### Recomendações
- **Sempre teste em ambiente de desenvolvimento primeiro**
- **Use modo DRY RUN para validar operações**
- **Mantenha backups do banco antes da execução**
- **Verifique logs após cada operação**
- **Confirme a migração antes de remover o usuário**

## Tratamento de Erros

### Erros Comuns e Soluções

#### Erro de Conexão
```
❌ Erro ao conectar com o banco de dados: Access denied
```
**Solução**: Verificar credenciais no arquivo `.env`

#### Usuário Não Encontrado
```
❌ Usuário origem (ID 41) não encontrado
```
**Solução**: Confirmar se o usuário existe na tabela `users`

#### Referências Restantes
```
❌ Não é seguro remover o usuário. 5 referências restantes encontradas
```
**Solução**: Executar migração novamente ou verificar tabelas manualmente

### Recuperação de Erros
- Transações são automaticamente revertidas em caso de erro
- Logs detalhados ajudam na identificação de problemas
- Backups permitem restauração manual se necessário

## Testes

### Suite de Testes Incluída
```bash
npm test
```

### Testes Executados
1. **Validação de Dependências**: Verifica módulos necessários
2. **Configuração**: Valida variáveis de ambiente
3. **Conexão**: Testa conectividade com MySQL
4. **Análise**: Verifica identificação de tabelas
5. **Usuários**: Confirma existência dos usuários

### Interpretação dos Resultados
- ✅ **PASSED**: Teste executado com sucesso
- ❌ **FAILED**: Teste falhou, verificar configuração
- 📋 **Relatório**: Salvo em `test-report-[timestamp].json`

## Personalização

### Modificar IDs de Usuário
Edite o arquivo `.env`:
```env
SOURCE_USER_ID=123
TARGET_USER_ID=456
```

### Adicionar Novas Tabelas
O sistema identifica automaticamente tabelas com:
- `user_id`
- `usuario_id`
- Colunas terminadas em `_user_id`

Para tabelas com nomenclatura diferente, modifique a função `findTablesWithUserId()` em `analyze-database.js`.

### Configurar Timeout
Modifique `config/database.js`:
```javascript
const dbConfig = {
    // ... outras configurações
    acquireTimeout: 120000,  // 2 minutos
    timeout: 120000
};
```

## Solução de Problemas

### Problemas de Performance
- **Tabelas grandes**: Considere migração em lotes
- **Timeout**: Aumente valores de timeout na configuração
- **Memória**: Monitor uso durante migração de grandes volumes

### Problemas de Integridade
- **Chaves estrangeiras**: Sistema identifica automaticamente
- **Constraints**: Verificar logs para violações
- **Dados órfãos**: Analisar relatório antes da migração

### Problemas de Conectividade
- **Firewall**: Verificar acesso à porta MySQL (3306)
- **SSL**: Configurar se necessário no `database.js`
- **Pool de conexões**: Ajustar limites se necessário

## Suporte e Manutenção

### Logs de Debug
Para logs mais detalhados, modifique `LOG_LEVEL` no `.env`:
```env
LOG_LEVEL=debug
```

### Monitoramento
- Acompanhe arquivos de log gerados
- Verifique integridade após migração
- Mantenha backups dos logs importantes

### Atualizações
- Mantenha dependências atualizadas: `npm update`
- Verifique compatibilidade com novas versões do MySQL
- Teste em ambiente de desenvolvimento antes de produção

## Licença

Este projeto está licenciado sob a Licença MIT. Consulte o arquivo LICENSE para mais detalhes.

## Autor

**Manus AI** - Sistema de migração de usuários MySQL

---

**⚠️ IMPORTANTE**: Este sistema realiza operações irreversíveis no banco de dados. Sempre teste em ambiente de desenvolvimento e mantenha backups atualizados antes de executar em produção.

