const { createPool } = require('./config/database');
const chalk = require('chalk');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

/**
 * Classe para exportar dump do banco de dados
 */
class DatabaseExporter {
    constructor() {
        this.pool = createPool();
        this.exportLog = [];
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'fiesto18_database'
        };
    }

    /**
     * Adiciona entrada ao log de export
     */
    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };
        this.exportLog.push(logEntry);
        
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
     * Salva o log de export em arquivo
     */
    saveExportLog() {
        const logFile = `export-log-${Date.now()}.json`;
        fs.writeFileSync(logFile, JSON.stringify({
            database: this.dbConfig.database,
            timestamp: new Date().toISOString(),
            log: this.exportLog
        }, null, 2));
        this.log('info', `Log de export salvo em: ${logFile}`);
        return logFile;
    }

    /**
     * Verifica se mysqldump está disponível
     */
    async checkMysqldumpAvailable() {
        return new Promise((resolve) => {
            const mysqldump = spawn('mysqldump', ['--version']);
            
            mysqldump.on('close', (code) => {
                resolve(code === 0);
            });
            
            mysqldump.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Gera nome do arquivo de dump
     */
    generateDumpFileName(compressed = false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `${this.dbConfig.database}-dump-${timestamp}`;
        return compressed ? `${baseName}.sql.gz` : `${baseName}.sql`;
    }

    /**
     * Executa mysqldump para exportar o banco
     */
    async executeMysqldump(outputFile, compressed = false) {
        return new Promise((resolve, reject) => {
            this.log('info', `Iniciando export do banco ${this.dbConfig.database}...`);
            
            const args = [
                '--host=' + this.dbConfig.host,
                '--port=' + this.dbConfig.port,
                '--user=' + this.dbConfig.user,
                '--password=' + this.dbConfig.password,
                '--single-transaction',
                '--routines',
                '--triggers',
                '--events',
                '--add-drop-table',
                '--add-locks',
                '--create-options',
                '--disable-keys',
                '--extended-insert',
                '--lock-tables=false',
                '--quick',
                '--set-charset',
                this.dbConfig.database
            ];

            this.log('info', 'Executando mysqldump com opções otimizadas...');
            
            const mysqldump = spawn('mysqldump', args);
            let outputStream;
            
            if (compressed) {
                const gzip = spawn('gzip', ['-c']);
                outputStream = fs.createWriteStream(outputFile);
                
                mysqldump.stdout.pipe(gzip.stdin);
                gzip.stdout.pipe(outputStream);
                
                gzip.on('close', (code) => {
                    if (code === 0) {
                        this.log('success', `Dump comprimido criado: ${outputFile}`);
                        resolve(outputFile);
                    } else {
                        reject(new Error(`Erro na compressão: código ${code}`));
                    }
                });
                
                gzip.on('error', (error) => {
                    reject(new Error(`Erro no gzip: ${error.message}`));
                });
            } else {
                outputStream = fs.createWriteStream(outputFile);
                mysqldump.stdout.pipe(outputStream);
                
                mysqldump.on('close', (code) => {
                    if (code === 0) {
                        this.log('success', `Dump criado: ${outputFile}`);
                        resolve(outputFile);
                    } else {
                        reject(new Error(`Erro no mysqldump: código ${code}`));
                    }
                });
            }
            
            mysqldump.on('error', (error) => {
                reject(new Error(`Erro ao executar mysqldump: ${error.message}`));
            });
            
            let errorOutput = '';
            mysqldump.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            mysqldump.on('close', (code) => {
                if (code !== 0 && errorOutput) {
                    this.log('error', 'Erro no mysqldump', errorOutput);
                }
            });
        });
    }

    /**
     * Exporta usando consultas SQL diretas (fallback)
     */
    async exportUsingSQL(outputFile) {
        try {
            this.log('info', 'Usando método de export SQL direto...');
            
            // Obter lista de tabelas
            const [tables] = await this.pool.execute(
                'SHOW TABLES FROM ' + this.dbConfig.database
            );
            
            let sqlDump = '';
            sqlDump += `-- MySQL dump gerado em ${new Date().toISOString()}\n`;
            sqlDump += `-- Banco de dados: ${this.dbConfig.database}\n\n`;
            sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n`;
            sqlDump += `SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";\n`;
            sqlDump += `SET time_zone = "+00:00";\n\n`;
            
            const tableKey = `Tables_in_${this.dbConfig.database}`;
            
            for (const tableRow of tables) {
                const tableName = tableRow[tableKey];
                
                this.log('info', `Exportando tabela: ${tableName}`);
                
                // Estrutura da tabela
                const [createTable] = await this.pool.execute(`SHOW CREATE TABLE ${tableName}`);
                sqlDump += `-- Estrutura da tabela ${tableName}\n`;
                sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
                sqlDump += createTable[0]['Create Table'] + ';\n\n';
                
                // Dados da tabela
                const [rows] = await this.pool.execute(`SELECT * FROM \`${tableName}\``);
                
                if (rows.length > 0) {
                    sqlDump += `-- Dados da tabela ${tableName}\n`;
                    sqlDump += `LOCK TABLES \`${tableName}\` WRITE;\n`;
                    
                    const columns = Object.keys(rows[0]);
                    const columnNames = columns.map(col => `\`${col}\``).join(', ');
                    
                    for (const row of rows) {
                        const values = columns.map(col => {
                            const value = row[col];
                            if (value === null) return 'NULL';
                            if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
                            if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            return value;
                        }).join(', ');
                        
                        sqlDump += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${values});\n`;
                    }
                    
                    sqlDump += `UNLOCK TABLES;\n\n`;
                }
            }
            
            sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`;
            
            fs.writeFileSync(outputFile, sqlDump);
            this.log('success', `Export SQL direto concluído: ${outputFile}`);
            
            return outputFile;
            
        } catch (error) {
            this.log('error', 'Erro no export SQL direto', error.message);
            throw error;
        }
    }

    /**
     * Verifica o tamanho do arquivo gerado
     */
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const sizeInBytes = stats.size;
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
            return { bytes: sizeInBytes, mb: sizeInMB };
        } catch (error) {
            return { bytes: 0, mb: '0.00' };
        }
    }

    /**
     * Valida o arquivo de dump gerado
     */
    async validateDump(filePath) {
        try {
            this.log('info', 'Validando arquivo de dump...');
            
            const fileSize = this.getFileSize(filePath);
            
            if (fileSize.bytes === 0) {
                throw new Error('Arquivo de dump está vazio');
            }
            
            // Ler primeiras linhas para verificar formato
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').slice(0, 10);
            
            const hasHeader = lines.some(line => line.includes('MySQL dump') || line.includes('mysqldump'));
            const hasSQLCommands = lines.some(line => line.trim().startsWith('CREATE') || line.trim().startsWith('INSERT'));
            
            if (!hasHeader && !hasSQLCommands) {
                throw new Error('Arquivo não parece ser um dump MySQL válido');
            }
            
            this.log('success', `Dump validado com sucesso (${fileSize.mb} MB)`);
            
            return {
                valid: true,
                size: fileSize,
                hasHeader,
                hasSQLCommands
            };
            
        } catch (error) {
            this.log('error', 'Erro na validação do dump', error.message);
            throw error;
        }
    }

    /**
     * Executa o processo completo de export
     */
    async run(compressed = true) {
        try {
            console.log(chalk.blue.bold('📦 INICIANDO EXPORT DO BANCO DE DADOS\n'));
            
            const outputFile = this.generateDumpFileName(compressed);
            this.log('info', `Arquivo de destino: ${outputFile}`);
            
            // Verificar se mysqldump está disponível
            const mysqldumpAvailable = await this.checkMysqldumpAvailable();
            
            let exportedFile;
            
            if (mysqldumpAvailable) {
                this.log('info', 'mysqldump disponível, usando método otimizado');
                exportedFile = await this.executeMysqldump(outputFile, compressed);
            } else {
                this.log('warning', 'mysqldump não disponível, usando método SQL direto');
                const sqlFile = this.generateDumpFileName(false);
                exportedFile = await this.exportUsingSQL(sqlFile);
                
                if (compressed) {
                    this.log('info', 'Comprimindo arquivo...');
                    // Implementar compressão manual se necessário
                }
            }
            
            // Validar dump
            const validation = await this.validateDump(exportedFile);
            
            // Salvar log
            const logFile = this.saveExportLog();
            
            console.log(chalk.green.bold('\n✅ EXPORT CONCLUÍDO COM SUCESSO!'));
            console.log(chalk.white(`📁 Arquivo: ${exportedFile}`));
            console.log(chalk.white(`📊 Tamanho: ${validation.size.mb} MB`));
            console.log(chalk.white(`📋 Log: ${logFile}`));
            
            return {
                exportedFile,
                validation,
                logFile
            };
            
        } catch (error) {
            this.log('error', 'Falha no export', error.message);
            this.saveExportLog();
            throw error;
        } finally {
            await this.pool.end();
        }
    }
}

// Executar export se chamado diretamente
if (require.main === module) {
    const exporter = new DatabaseExporter();
    const compressed = process.argv.includes('--no-compress') ? false : true;
    
    exporter.run(compressed)
        .then((result) => {
            console.log(chalk.green.bold('\n🎉 Export finalizado!'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n💥 Falha no export:'), error.message);
            process.exit(1);
        });
}

module.exports = DatabaseExporter;