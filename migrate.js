const { createPool } = require('./config/database');
const DatabaseAnalyzer = require('./analyze-database');
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();

/**
 * Classe principal para migração de dados de usuário
 */
class UserMigrator {
    constructor() {
        this.pool = createPool();
        this.sourceUserId = parseInt(process.env.SOURCE_USER_ID) || 41;
        this.targetUserId = parseInt(process.env.TARGET_USER_ID) || 358;
        this.dryRun = process.env.DRY_RUN === 'true';
        this.migrationLog = [];
    }

    /**
     * Adiciona entrada ao log de migração
     */
    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };
        this.migrationLog.push(logEntry);
        
        const colorMap = {
            info: chalk.blue,
            success: chalk.green,
            warning: chalk.yellow,
            error: chalk.red
        };
        
        console.log(colorMap[level] || chalk.white, `[${level.toUpperCase()}] ${message}`);
        if (data) {
            console.log(chalk.gray('  Data:'), data);
        }
    }

    /**
     * Salva o log de migração em arquivo
     */
    saveMigrationLog() {
        const logFile = `migration-log-${Date.now()}.json`;
        fs.writeFileSync(logFile, JSON.stringify({
            sourceUserId: this.sourceUserId,
            targetUserId: this.targetUserId,
            dryRun: this.dryRun,
            timestamp: new Date().toISOString(),
            log: this.migrationLog
        }, null, 2));
        this.log('info', `Log de migração salvo em: ${logFile}`);
        return logFile;
    }

    /**
     * Valida pré-requisitos para migração
     */
    async validatePrerequisites() {
        this.log('info', 'Validando pré-requisitos para migração...');
        
        // Verificar se o usuário origem existe
        const [sourceUser] = await this.pool.execute(
            'SELECT * FROM users WHERE id = ? LIMIT 1',
            [this.sourceUserId]
        );
        
        if (sourceUser.length === 0) {
            throw new Error(`Usuário origem (ID ${this.sourceUserId}) não encontrado`);
        }
        
        // Verificar se o usuário destino existe
        const [targetUser] = await this.pool.execute(
            'SELECT * FROM users WHERE id = ? LIMIT 1',
            [this.targetUserId]
        );
        
        if (targetUser.length === 0) {
            throw new Error(`Usuário destino (ID ${this.targetUserId}) não encontrado`);
        }
        
        this.log('success', 'Pré-requisitos validados com sucesso', {
            sourceUser: sourceUser[0].name || sourceUser[0].email,
            targetUser: targetUser[0].name || targetUser[0].email
        });
        
        return { sourceUser: sourceUser[0], targetUser: targetUser[0] };
    }

    /**
     * Migra dados de uma tabela específica
     */
    async migrateTable(tableName, userIdColumn) {
        try {
            this.log('info', `Iniciando migração da tabela: ${tableName}`);
            
            // Contar registros a migrar
            const [countResult] = await this.pool.execute(
                `SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn} = ?`,
                [this.sourceUserId]
            );
            
            const recordCount = countResult[0].count;
            
            if (recordCount === 0) {
                this.log('info', `Tabela ${tableName}: Nenhum registro encontrado`);
                return { migrated: 0, skipped: 0 };
            }
            
            this.log('info', `Tabela ${tableName}: ${recordCount} registros encontrados`);
            
            if (this.dryRun) {
                this.log('warning', `DRY RUN: Simulando migração de ${recordCount} registros`);
                return { migrated: 0, skipped: recordCount };
            }
            
            // Verificar se há conflitos (registros que já existem para o usuário destino)
            const [conflictCheck] = await this.pool.execute(
                `SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn} = ?`,
                [this.targetUserId]
            );
            
            const existingRecords = conflictCheck[0].count;
            if (existingRecords > 0) {
                this.log('warning', `Tabela ${tableName}: ${existingRecords} registros já existem para o usuário destino`);
            }
            
            // Executar migração
            const [updateResult] = await this.pool.execute(
                `UPDATE ${tableName} SET ${userIdColumn} = ? WHERE ${userIdColumn} = ?`,
                [this.targetUserId, this.sourceUserId]
            );
            
            this.log('success', `Tabela ${tableName}: ${updateResult.affectedRows} registros migrados`);
            
            return { 
                migrated: updateResult.affectedRows, 
                skipped: 0,
                existingRecords 
            };
            
        } catch (error) {
            this.log('error', `Erro na migração da tabela ${tableName}`, error.message);
            throw error;
        }
    }

    /**
     * Executa migração completa
     */
    async executeMigration() {
        let connection;
        try {
            this.log('info', `Iniciando migração ${this.dryRun ? '(DRY RUN)' : ''}`);
            this.log('info', `Usuário origem: ${this.sourceUserId} → Usuário destino: ${this.targetUserId}`);
            
            // Validar pré-requisitos
            const users = await this.validatePrerequisites();
            
            // Analisar banco de dados
            const analyzer = new DatabaseAnalyzer();
            const tableMap = await analyzer.findTablesWithUserId();
            const recordCounts = await analyzer.countRecordsByTable(tableMap);
            
            // Iniciar transação
            connection = await this.pool.getConnection();
            if (!this.dryRun) {
                await connection.beginTransaction();
                this.log('info', 'Transação iniciada');
            }
            
            const migrationResults = {};
            let totalMigrated = 0;
            
            // Migrar cada tabela
            for (const [tableName, columns] of Object.entries(tableMap)) {
                const userIdColumn = columns.find(col => 
                    col.column === 'user_id' || 
                    col.column === 'usuario_id' ||
                    col.column.endsWith('_user_id')
                );
                
                if (userIdColumn && recordCounts[tableName]?.count > 0) {
                    try {
                        const result = await this.migrateTable(tableName, userIdColumn.column);
                        migrationResults[tableName] = result;
                        totalMigrated += result.migrated;
                    } catch (error) {
                        this.log('error', `Falha na migração da tabela ${tableName}`, error.message);
                        if (!this.dryRun) {
                            await connection.rollback();
                            this.log('error', 'Transação revertida devido ao erro');
                        }
                        throw error;
                    }
                }
            }
            
            // Confirmar transação
            if (!this.dryRun && totalMigrated > 0) {
                await connection.commit();
                this.log('success', 'Transação confirmada com sucesso');
            }
            
            this.log('success', `Migração concluída: ${totalMigrated} registros migrados`);
            
            return {
                sourceUserId: this.sourceUserId,
                targetUserId: this.targetUserId,
                totalMigrated,
                migrationResults,
                dryRun: this.dryRun
            };
            
        } catch (error) {
            this.log('error', 'Erro durante a migração', error.message);
            if (connection && !this.dryRun) {
                try {
                    await connection.rollback();
                    this.log('info', 'Transação revertida');
                } catch (rollbackError) {
                    this.log('error', 'Erro ao reverter transação', rollbackError.message);
                }
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Verifica integridade após migração
     */
    async verifyMigration() {
        try {
            this.log('info', 'Verificando integridade da migração...');
            
            const analyzer = new DatabaseAnalyzer();
            const tableMap = await analyzer.findTablesWithUserId();
            const verificationResults = {};
            
            for (const [tableName, columns] of Object.entries(tableMap)) {
                const userIdColumn = columns.find(col => 
                    col.column === 'user_id' || 
                    col.column === 'usuario_id' ||
                    col.column.endsWith('_user_id')
                );
                
                if (userIdColumn) {
                    const [sourceCount] = await this.pool.execute(
                        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn.column} = ?`,
                        [this.sourceUserId]
                    );
                    
                    const [targetCount] = await this.pool.execute(
                        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn.column} = ?`,
                        [this.targetUserId]
                    );
                    
                    verificationResults[tableName] = {
                        sourceRemaining: sourceCount[0].count,
                        targetTotal: targetCount[0].count
                    };
                    
                    if (sourceCount[0].count > 0) {
                        this.log('warning', `Tabela ${tableName}: ${sourceCount[0].count} registros ainda vinculados ao usuário origem`);
                    }
                }
            }
            
            const totalSourceRemaining = Object.values(verificationResults)
                .reduce((sum, result) => sum + result.sourceRemaining, 0);
            
            if (totalSourceRemaining === 0) {
                this.log('success', 'Verificação concluída: Nenhum registro restante para o usuário origem');
            } else {
                this.log('warning', `Verificação: ${totalSourceRemaining} registros ainda vinculados ao usuário origem`);
            }
            
            return verificationResults;
            
        } catch (error) {
            this.log('error', 'Erro na verificação', error.message);
            throw error;
        }
    }

    /**
     * Executa processo completo de migração
     */
    async run() {
        try {
            console.log(chalk.blue.bold('🚀 INICIANDO MIGRAÇÃO DE USUÁRIO\n'));
            
            const migrationResult = await this.executeMigration();
            const verificationResult = await this.verifyMigration();
            
            const logFile = this.saveMigrationLog();
            
            console.log(chalk.green.bold('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!'));
            console.log(chalk.white(`📊 Registros migrados: ${migrationResult.totalMigrated}`));
            console.log(chalk.white(`📋 Log salvo em: ${logFile}`));
            
            return {
                migration: migrationResult,
                verification: verificationResult,
                logFile
            };
            
        } catch (error) {
            this.log('error', 'Falha na migração', error.message);
            this.saveMigrationLog();
            throw error;
        } finally {
            await this.pool.end();
        }
    }
}

// Executar migração se chamado diretamente
if (require.main === module) {
    const migrator = new UserMigrator();
    migrator.run()
        .then(() => {
            console.log(chalk.green.bold('\n🎉 Processo finalizado!'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n💥 Falha no processo:'), error.message);
            process.exit(1);
        });
}

module.exports = UserMigrator;

