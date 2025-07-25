const { createPool } = require('./config/database');
const DatabaseAnalyzer = require('./analyze-database');
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();

/**
 * Classe para remoção segura de usuário após migração
 */
class UserRemover {
    constructor() {
        this.pool = createPool();
        this.sourceUserId = parseInt(process.env.SOURCE_USER_ID) || 41;
        this.dryRun = process.env.DRY_RUN === 'true';
        this.removalLog = [];
    }

    /**
     * Adiciona entrada ao log de remoção
     */
    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };
        this.removalLog.push(logEntry);
        
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
     * Salva o log de remoção em arquivo
     */
    saveRemovalLog() {
        const logFile = `removal-log-${Date.now()}.json`;
        fs.writeFileSync(logFile, JSON.stringify({
            sourceUserId: this.sourceUserId,
            dryRun: this.dryRun,
            timestamp: new Date().toISOString(),
            log: this.removalLog
        }, null, 2));
        this.log('info', `Log de remoção salvo em: ${logFile}`);
        return logFile;
    }

    /**
     * Verifica se é seguro remover o usuário
     */
    async verifySafeToRemove() {
        try {
            this.log('info', 'Verificando se é seguro remover o usuário...');
            
            const analyzer = new DatabaseAnalyzer();
            const tableMap = await analyzer.findTablesWithUserId();
            const safetyCheck = {};
            let totalReferences = 0;
            
            // Verificar cada tabela para referências restantes
            for (const [tableName, columns] of Object.entries(tableMap)) {
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
                    
                    const count = countResult[0].count;
                    safetyCheck[tableName] = {
                        column: userIdColumn.column,
                        remainingReferences: count
                    };
                    
                    totalReferences += count;
                    
                    if (count > 0) {
                        this.log('warning', `Tabela ${tableName}: ${count} referências restantes na coluna ${userIdColumn.column}`);
                    }
                }
            }
            
            const isSafe = totalReferences === 0;
            
            if (isSafe) {
                this.log('success', 'Verificação concluída: É seguro remover o usuário');
            } else {
                this.log('error', `Verificação falhou: ${totalReferences} referências restantes encontradas`);
            }
            
            return {
                isSafe,
                totalReferences,
                safetyCheck
            };
            
        } catch (error) {
            this.log('error', 'Erro na verificação de segurança', error.message);
            throw error;
        }
    }

    /**
     * Encontra e analisa chaves estrangeiras que referenciam o usuário
     */
    async analyzeForeignKeys() {
        try {
            this.log('info', 'Analisando chaves estrangeiras...');
            
            const [foreignKeys] = await this.pool.execute(`
                SELECT 
                    TABLE_NAME,
                    COLUMN_NAME,
                    CONSTRAINT_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE REFERENCED_TABLE_SCHEMA = ?
                AND REFERENCED_TABLE_NAME IS NOT NULL
                AND (COLUMN_NAME LIKE '%user_id%' OR REFERENCED_COLUMN_NAME LIKE '%user_id%')
                ORDER BY TABLE_NAME
            `, [process.env.DB_NAME]);
            
            this.log('info', `Encontradas ${foreignKeys.length} chaves estrangeiras relacionadas a user_id`);
            
            const fkAnalysis = {};
            for (const fk of foreignKeys) {
                if (!fkAnalysis[fk.TABLE_NAME]) {
                    fkAnalysis[fk.TABLE_NAME] = [];
                }
                fkAnalysis[fk.TABLE_NAME].push({
                    column: fk.COLUMN_NAME,
                    constraint: fk.CONSTRAINT_NAME,
                    referencedTable: fk.REFERENCED_TABLE_NAME,
                    referencedColumn: fk.REFERENCED_COLUMN_NAME
                });
            }
            
            return fkAnalysis;
            
        } catch (error) {
            this.log('error', 'Erro na análise de chaves estrangeiras', error.message);
            throw error;
        }
    }

    /**
     * Cria backup do usuário antes da remoção
     */
    async createUserBackup() {
        try {
            this.log('info', 'Criando backup do usuário...');
            
            // Buscar dados do usuário na tabela principal
            const [userData] = await this.pool.execute(
                'SELECT * FROM users WHERE id = ?',
                [this.sourceUserId]
            );
            
            if (userData.length === 0) {
                throw new Error(`Usuário ${this.sourceUserId} não encontrado para backup`);
            }
            
            const user = userData[0];
            const backupData = {
                timestamp: new Date().toISOString(),
                userId: this.sourceUserId,
                userData: user,
                backupReason: 'Pre-deletion backup'
            };
            
            const backupFile = `user-backup-${this.sourceUserId}-${Date.now()}.json`;
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            
            this.log('success', `Backup do usuário criado: ${backupFile}`, {
                userName: user.name || user.email,
                backupFile
            });
            
            return backupFile;
            
        } catch (error) {
            this.log('error', 'Erro ao criar backup', error.message);
            throw error;
        }
    }

    /**
     * Remove o usuário da tabela principal
     */
    async removeUserRecord() {
        try {
            this.log('info', `Removendo usuário ${this.sourceUserId} da tabela users...`);
            
            if (this.dryRun) {
                this.log('warning', 'DRY RUN: Simulando remoção do usuário');
                return { removed: false, simulated: true };
            }
            
            const [deleteResult] = await this.pool.execute(
                'DELETE FROM users WHERE id = ?',
                [this.sourceUserId]
            );
            
            if (deleteResult.affectedRows === 0) {
                throw new Error(`Nenhum usuário encontrado com ID ${this.sourceUserId}`);
            }
            
            this.log('success', `Usuário ${this.sourceUserId} removido com sucesso`);
            
            return { 
                removed: true, 
                affectedRows: deleteResult.affectedRows 
            };
            
        } catch (error) {
            this.log('error', 'Erro ao remover usuário', error.message);
            throw error;
        }
    }

    /**
     * Verifica se a remoção foi bem-sucedida
     */
    async verifyRemoval() {
        try {
            this.log('info', 'Verificando se a remoção foi bem-sucedida...');
            
            const [userCheck] = await this.pool.execute(
                'SELECT COUNT(*) as count FROM users WHERE id = ?',
                [this.sourceUserId]
            );
            
            const userExists = userCheck[0].count > 0;
            
            if (userExists) {
                this.log('error', `Usuário ${this.sourceUserId} ainda existe na tabela users`);
                return { success: false, userStillExists: true };
            } else {
                this.log('success', `Confirmado: Usuário ${this.sourceUserId} foi removido com sucesso`);
                return { success: true, userStillExists: false };
            }
            
        } catch (error) {
            this.log('error', 'Erro na verificação de remoção', error.message);
            throw error;
        }
    }

    /**
     * Executa processo completo de remoção segura
     */
    async run() {
        let connection;
        try {
            console.log(chalk.red.bold('🗑️  INICIANDO REMOÇÃO SEGURA DE USUÁRIO\n'));
            
            // Verificar se é seguro remover
            const safetyResult = await this.verifySafeToRemove();
            
            if (!safetyResult.isSafe) {
                throw new Error(`Não é seguro remover o usuário. ${safetyResult.totalReferences} referências restantes encontradas.`);
            }
            
            // Analisar chaves estrangeiras
            const fkAnalysis = await this.analyzeForeignKeys();
            
            // Criar backup
            const backupFile = await this.createUserBackup();
            
            // Iniciar transação para remoção
            connection = await this.pool.getConnection();
            if (!this.dryRun) {
                await connection.beginTransaction();
                this.log('info', 'Transação de remoção iniciada');
            }
            
            // Remover usuário
            const removalResult = await this.removeUserRecord();
            
            // Verificar remoção
            const verificationResult = await this.verifyRemoval();
            
            if (!this.dryRun && verificationResult.success) {
                await connection.commit();
                this.log('success', 'Transação de remoção confirmada');
            } else if (!this.dryRun) {
                await connection.rollback();
                this.log('error', 'Transação de remoção revertida devido à falha na verificação');
            }
            
            const logFile = this.saveRemovalLog();
            
            console.log(chalk.green.bold('\n✅ REMOÇÃO CONCLUÍDA COM SUCESSO!'));
            console.log(chalk.white(`👤 Usuário removido: ${this.sourceUserId}`));
            console.log(chalk.white(`💾 Backup salvo em: ${backupFile}`));
            console.log(chalk.white(`📋 Log salvo em: ${logFile}`));
            
            return {
                safety: safetyResult,
                foreignKeys: fkAnalysis,
                backup: backupFile,
                removal: removalResult,
                verification: verificationResult,
                logFile
            };
            
        } catch (error) {
            this.log('error', 'Falha na remoção', error.message);
            if (connection && !this.dryRun) {
                try {
                    await connection.rollback();
                    this.log('info', 'Transação revertida devido ao erro');
                } catch (rollbackError) {
                    this.log('error', 'Erro ao reverter transação', rollbackError.message);
                }
            }
            this.saveRemovalLog();
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
            await this.pool.end();
        }
    }
}

// Executar remoção se chamado diretamente
if (require.main === module) {
    const remover = new UserRemover();
    remover.run()
        .then(() => {
            console.log(chalk.green.bold('\n🎉 Processo de remoção finalizado!'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n💥 Falha no processo de remoção:'), error.message);
            process.exit(1);
        });
}

module.exports = UserRemover;

