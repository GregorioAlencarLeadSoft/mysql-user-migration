const { createPool } = require('./config/database');
const chalk = require('chalk');
require('dotenv').config();

/**
 * Analisa a estrutura do banco de dados para identificar tabelas com user_id
 */
class DatabaseAnalyzer {
    constructor() {
        this.pool = createPool();
        this.sourceUserId = process.env.SOURCE_USER_ID || 41;
        this.targetUserId = process.env.TARGET_USER_ID || 358;
    }

    /**
     * Encontra todas as tabelas que contêm a coluna user_id
     */
    async findTablesWithUserId() {
        try {
            console.log(chalk.blue('🔍 Procurando tabelas com coluna user_id...'));
            
            const [rows] = await this.pool.execute(`
                SELECT 
                    TABLE_NAME,
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_KEY,
                    EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND COLUMN_NAME LIKE '%user_id%'
                ORDER BY TABLE_NAME, COLUMN_NAME
            `, [process.env.DB_NAME]);

            console.log(chalk.green(`✅ Encontradas ${rows.length} colunas relacionadas a user_id:`));
            
            const tableMap = {};
            rows.forEach(row => {
                if (!tableMap[row.TABLE_NAME]) {
                    tableMap[row.TABLE_NAME] = [];
                }
                tableMap[row.TABLE_NAME].push({
                    column: row.COLUMN_NAME,
                    type: row.DATA_TYPE,
                    nullable: row.IS_NULLABLE,
                    key: row.COLUMN_KEY,
                    extra: row.EXTRA
                });
            });

            return tableMap;
        } catch (error) {
            console.error(chalk.red('❌ Erro ao analisar tabelas:'), error.message);
            throw error;
        }
    }

    /**
     * Verifica se os usuários existem no banco
     */
    async checkUsersExist() {
        try {
            console.log(chalk.blue('👥 Verificando existência dos usuários...'));
            
            // Primeiro, vamos tentar encontrar a tabela de usuários
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

            // Vamos verificar em cada tabela se encontramos os usuários
            const userInfo = {
                sourceUser: null,
                targetUser: null,
                userTable: null
            };

            for (const table of userTables) {
                try {
                    const [sourceCheck] = await this.pool.execute(
                        `SELECT * FROM ${table.TABLE_NAME} WHERE id = ? LIMIT 1`,
                        [this.sourceUserId]
                    );
                    
                    const [targetCheck] = await this.pool.execute(
                        `SELECT * FROM ${table.TABLE_NAME} WHERE id = ? LIMIT 1`,
                        [this.targetUserId]
                    );

                    if (sourceCheck.length > 0 || targetCheck.length > 0) {
                        userInfo.userTable = table.TABLE_NAME;
                        userInfo.sourceUser = sourceCheck[0] || null;
                        userInfo.targetUser = targetCheck[0] || null;
                        break;
                    }
                } catch (err) {
                    // Tabela pode não ter coluna 'id', continuar
                    continue;
                }
            }

            if (userInfo.sourceUser) {
                console.log(chalk.green(`✅ Usuário origem (ID ${this.sourceUserId}) encontrado na tabela ${userInfo.userTable}`));
                console.log(`   Nome: ${userInfo.sourceUser.name || userInfo.sourceUser.nome || 'N/A'}`);
            } else {
                console.log(chalk.red(`❌ Usuário origem (ID ${this.sourceUserId}) NÃO encontrado`));
            }

            if (userInfo.targetUser) {
                console.log(chalk.green(`✅ Usuário destino (ID ${this.targetUserId}) encontrado na tabela ${userInfo.userTable}`));
                console.log(`   Nome: ${userInfo.targetUser.name || userInfo.targetUser.nome || 'N/A'}`);
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
    async countRecordsByTable(tableMap) {
        try {
            console.log(chalk.blue('📊 Contando registros por tabela...'));
            
            const recordCounts = {};
            
            for (const [tableName, columns] of Object.entries(tableMap)) {
                try {
                    // Procura pela coluna user_id principal
                    const userIdColumn = columns.find(col => 
                        col.column === 'user_id' || 
                        col.column === 'usuario_id' ||
                        col.column.endsWith('_user_id')
                    );

                    if (userIdColumn) {
                        const [countResult] = await this.pool.execute(
                            `SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn.column} = ?`,
                            [this.sourceUserId]
                        );
                        
                        recordCounts[tableName] = {
                            count: countResult[0].count,
                            column: userIdColumn.column
                        };
                        
                        if (countResult[0].count > 0) {
                            console.log(chalk.yellow(`  ${tableName}: ${countResult[0].count} registros (coluna: ${userIdColumn.column})`));
                        }
                    }
                } catch (err) {
                    console.log(chalk.gray(`  ${tableName}: Erro ao contar - ${err.message}`));
                    recordCounts[tableName] = { count: 0, error: err.message };
                }
            }

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
            
            const tableMap = await this.findTablesWithUserId();
            const userInfo = await this.checkUsersExist();
            const recordCounts = await this.countRecordsByTable(tableMap);

            // Gerar relatório em arquivo
            const report = {
                timestamp: new Date().toISOString(),
                database: process.env.DB_NAME,
                sourceUserId: this.sourceUserId,
                targetUserId: this.targetUserId,
                userInfo,
                tableMap,
                recordCounts,
                summary: {
                    totalTables: Object.keys(tableMap).length,
                    tablesWithData: Object.values(recordCounts).filter(r => r.count > 0).length,
                    totalRecords: Object.values(recordCounts).reduce((sum, r) => sum + (r.count || 0), 0)
                }
            };

            // Salvar relatório
            const fs = require('fs');
            fs.writeFileSync(
                './database-analysis-report.json',
                JSON.stringify(report, null, 2)
            );

            console.log(chalk.green.bold('\n📋 RESUMO DA ANÁLISE:'));
            console.log(chalk.white(`  • Total de tabelas com user_id: ${report.summary.totalTables}`));
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

