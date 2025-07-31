const { createPool } = require('./config/database');
const { getMigrationTables, validateTablesExist, validateColumnsExist } = require('./config/tables');
const chalk = require('chalk');
require('dotenv').config();

/**
 * Analisa a estrutura do banco de dados para as tabelas específicas
 */
class DatabaseAnalyzer {
    constructor() {
        this.pool = createPool();
        this.sourceUserId = process.env.SOURCE_USER_ID || 41;
        this.targetUserId = process.env.TARGET_USER_ID || 358;
        this.migrationTables = getMigrationTables();
    }

    /**
     * Valida se as tabelas e colunas especificadas existem
     */
    async validateMigrationTables() {
        try {
            console.log(chalk.blue('🔍 Validando tabelas especificadas para migração...'));
            
            const tableValidation = await validateTablesExist(this.pool);
            const columnValidation = await validateColumnsExist(this.pool);
            
            console.log(chalk.green('📋 Tabelas especificadas para migração:'));
            
            const validationResults = {};
            let allValid = true;
            
            for (const tableConfig of this.migrationTables) {
                const tableName = tableConfig.table;
                const columnName = tableConfig.column;
                
                const tableExists = tableValidation[tableName]?.exists || false;
                const columnExists = columnValidation[tableName]?.columnExists || false;
                
                validationResults[tableName] = {
                    table: tableName,
                    column: columnName,
                    tableExists,
                    columnExists,
                    valid: tableExists && columnExists
                };
                
                if (tableExists && columnExists) {
                    console.log(chalk.green(`  ✅ ${tableName}.${columnName} - OK`));
                } else if (!tableExists) {
                    console.log(chalk.red(`  ❌ ${tableName}.${columnName} - Tabela não encontrada`));
                    allValid = false;
                } else if (!columnExists) {
                    console.log(chalk.red(`  ❌ ${tableName}.${columnName} - Coluna não encontrada`));
                    allValid = false;
                }
            }
            
            if (!allValid) {
                throw new Error('Algumas tabelas ou colunas especificadas não foram encontradas no banco de dados');
            }
            
            console.log(chalk.green('✅ Todas as tabelas e colunas especificadas foram validadas'));
            return validationResults;
            
        } catch (error) {
            console.error(chalk.red('❌ Erro na validação das tabelas:'), error.message);
            throw error;
        }
    }

    /**
     * Verifica se os usuários existem no banco
     */
    async checkUsersExist() {
        try {
            console.log(chalk.blue('👥 Verificando existência dos usuários...'));
            
            // Procurar tabela de usuários
            const [userTables] = await this.pool.execute(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = ? 
                AND (TABLE_NAME LIKE '%user%' OR TABLE_NAME LIKE '%usuario%')
                ORDER BY TABLE_NAME
            `, [process.env.DB_NAME]);

            console.log(chalk.yellow('📋 Tabelas relacionadas a usuários encontradas:'));
            userTables.forEach(table => {
                console.log(`  - ${table.TABLE_NAME}`);
            });

            const userInfo = {
                sourceUser: null,
                targetUser: null,
                userTable: null
            };

            for (const table of userTables) {
                try {
                    const [sourceCheck] = await this.pool.execute(
                        `SELECT * FROM \`${table.TABLE_NAME}\` WHERE id = ? LIMIT 1`,
                        [this.sourceUserId]
                    );
                    
                    const [targetCheck] = await this.pool.execute(
                        `SELECT * FROM \`${table.TABLE_NAME}\` WHERE id = ? LIMIT 1`,
                        [this.targetUserId]
                    );

                    if (sourceCheck.length > 0 || targetCheck.length > 0) {
                        userInfo.userTable = table.TABLE_NAME;
                        userInfo.sourceUser = sourceCheck[0] || null;
                        userInfo.targetUser = targetCheck[0] || null;
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }

            if (userInfo.sourceUser) {
                console.log(chalk.green(`✅ Usuário origem (ID ${this.sourceUserId}) encontrado na tabela ${userInfo.userTable}`));
                console.log(`   Nome: ${userInfo.sourceUser.name || userInfo.sourceUser.nome || userInfo.sourceUser.email || 'N/A'}`);
            } else {
                console.log(chalk.red(`❌ Usuário origem (ID ${this.sourceUserId}) NÃO encontrado`));
            }

            if (userInfo.targetUser) {
                console.log(chalk.green(`✅ Usuário destino (ID ${this.targetUserId}) encontrado na tabela ${userInfo.userTable}`));
                console.log(`   Nome: ${userInfo.targetUser.name || userInfo.targetUser.nome || userInfo.targetUser.email || 'N/A'}`);
            } else {
                console.log(chalk.red(`❌ Usuário destino (ID ${this.targetUserId}) NÃO encontrado`));
            }

            return userInfo;
        } catch (error) {
            console.error(chalk.red('❌ Erro ao verificar usuários:'), error.message);
            throw error;
        }
    }

    /**
     * Conta registros por tabela para o usuário origem
     */
    async countRecordsByTable() {
        try {
            console.log(chalk.blue('📊 Contando registros por tabela especificada...'));
            
            const recordCounts = {};
            let totalRecords = 0;
            
            for (const tableConfig of this.migrationTables) {
                try {
                    const [countResult] = await this.pool.execute(
                        `SELECT COUNT(*) as count FROM ${tableConfig.table} WHERE ${tableConfig.column} = ?`,
                        [this.sourceUserId]
                    );
                    
                    const count = countResult[0].count;
                    recordCounts[tableConfig.table] = {
                        count: count,
                        column: tableConfig.column
                    };
                    
                    totalRecords += count;
                    
                    if (count > 0) {
                        console.log(chalk.yellow(`  ${tableConfig.table}: ${count} registros (coluna: ${tableConfig.column})`));
                    } else {
                        console.log(chalk.gray(`  ${tableConfig.table}: 0 registros (coluna: ${tableConfig.column})`));
                    }
                } catch (err) {
                    console.log(chalk.red(`  ${tableConfig.table}: Erro ao contar - ${err.message}`));
                    recordCounts[tableConfig.table] = { count: 0, error: err.message, column: tableConfig.column };
                }
            }
            
            console.log(chalk.blue(`📈 Total de registros a migrar: ${totalRecords}`));
            return recordCounts;
            
        } catch (error) {
            console.error(chalk.red('❌ Erro ao contar registros:'), error.message);
            throw error;
        }
    }

    /**
     * Gera relatório completo da análise
     */
    async generateReport() {
        try {
            console.log(chalk.blue.bold('\n🔍 INICIANDO ANÁLISE DO BANCO DE DADOS\n'));
            
            const tableValidation = await this.validateMigrationTables();
            const userInfo = await this.checkUsersExist();
            const recordCounts = await this.countRecordsByTable();

            const report = {
                timestamp: new Date().toISOString(),
                database: process.env.DB_NAME,
                sourceUserId: this.sourceUserId,
                targetUserId: this.targetUserId,
                migrationTables: this.migrationTables,
                tableValidation,
                userInfo,
                recordCounts,
                summary: {
                    totalTables: this.migrationTables.length,
                    validTables: Object.values(tableValidation).filter(t => t.valid).length,
                    tablesWithData: Object.values(recordCounts).filter(r => r.count > 0).length,
                    totalRecords: Object.values(recordCounts).reduce((sum, r) => sum + (r.count || 0), 0)
                }
            };

            const fs = require('fs');
            fs.writeFileSync(
                './database-analysis-report.json',
                JSON.stringify(report, null, 2)
            );

            console.log(chalk.green.bold('\n📋 RESUMO DA ANÁLISE:'));
            console.log(chalk.white(`  • Tabelas especificadas: ${report.summary.totalTables}`));
            console.log(chalk.white(`  • Tabelas válidas: ${report.summary.validTables}`));
            console.log(chalk.white(`  • Tabelas com dados do usuário ${this.sourceUserId}: ${report.summary.tablesWithData}`));
            console.log(chalk.white(`  • Total de registros a migrar: ${report.summary.totalRecords}`));
            console.log(chalk.white(`  • Relatório salvo em: database-analysis-report.json`));

            return report;
        } catch (error) {
            console.error(chalk.red('❌ Erro na análise:'), error.message);
            throw error;
        } finally {
            await this.pool.end();
        }
    }
}

// Executar análise se chamado diretamente
if (require.main === module) {
    const analyzer = new DatabaseAnalyzer();
    analyzer.generateReport()
        .then(() => {
            console.log(chalk.green.bold('\n✅ Análise concluída com sucesso!'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n❌ Falha na análise:'), error.message);
            process.exit(1);
        });
}

module.exports = DatabaseAnalyzer;