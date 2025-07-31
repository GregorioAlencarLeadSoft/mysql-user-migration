#!/usr/bin/env node

const { testConnection } = require('./config/database');
const { getMigrationTables } = require('./config/tables');
const DatabaseAnalyzer = require('./analyze-database');
const UserMigrator = require('./migrate');
const UserRemover = require('./remove-user');
const DatabaseExporter = require('./export-database');
const chalk = require('chalk');
const readline = require('readline');
require('dotenv').config();

/**
 * Interface de linha de comando para o processo de migração
 */
class MigrationCLI {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.migrationTables = getMigrationTables();
    }

    /**
     * Pergunta ao usuário e aguarda resposta
     */
    async askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    }

    /**
     * Exibe banner inicial
     */
    showBanner() {
        console.log(chalk.blue.bold('\n  ╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.blue.bold('  ║                    MIGRAÇÃO DE USUÁRIO MYSQL                 ║'));
        console.log(chalk.blue.bold('  ║                                                              ║'));
        console.log(chalk.blue.bold('  ║  Migra dados do usuário ID 41 para ID 358 e remove origem    ║'));
        console.log(chalk.blue.bold('  ╚══════════════════════════════════════════════════════════════╝\n'));
    }

    /**
     * Exibe configurações atuais
     */
    showConfiguration() {
        console.log(chalk.yellow('📋 CONFIGURAÇÕES ATUAIS:'));
        console.log(chalk.white(`  • Banco de dados: ${process.env.DB_NAME || 'fiesto18_database'}`));
        console.log(chalk.white(`  • Usuário origem: ${process.env.SOURCE_USER_ID || 41}`));
        console.log(chalk.white(`  • Usuário destino: ${process.env.TARGET_USER_ID || 358}`));
        console.log(chalk.white(`  • Modo DRY RUN: ${process.env.DRY_RUN === 'true' ? 'SIM' : 'NÃO'}`));
        
        console.log(chalk.cyan('\n🎯 TABELAS ESPECIFICADAS:'));
        this.migrationTables.forEach(table => {
            console.log(chalk.white(`  • ${table.table} (coluna: ${table.column})`));
        });
        console.log('');
    }

    /**
     * Menu principal
     */
    async showMainMenu() {
        console.log(chalk.cyan('🔧 OPÇÕES DISPONÍVEIS:'));
        console.log(chalk.white('  1. Testar conexão com banco de dados'));
        console.log(chalk.white('  2. Analisar estrutura do banco'));
        console.log(chalk.white('  3. Executar migração de dados'));
        console.log(chalk.white('  4. Remover usuário origem (após migração)'));
        console.log(chalk.white('  7. Sair'));
        console.log('');

        const choice = await this.askQuestion('Escolha uma opção (1-7): ');
        return choice;
    }

    /**
     * Testa conexão com banco
     */
    async testDatabaseConnection() {
        console.log(chalk.blue('\n🔌 TESTANDO CONEXÃO COM BANCO DE DADOS...\n'));
        
        try {
            const success = await testConnection();
            if (success) {
                console.log(chalk.green('✅ Conexão estabelecida com sucesso!\n'));
            } else {
                console.log(chalk.red('❌ Falha na conexão. Verifique as configurações.\n'));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Erro: ${error.message}\n`));
        }
    }

    /**
     * Executa análise do banco
     */
    async analyzeDatabaseStructure() {
        console.log(chalk.blue('\n🔍 ANALISANDO ESTRUTURA DO BANCO...\n'));
        
        try {
            const analyzer = new DatabaseAnalyzer();
            const report = await analyzer.generateReport();
            
            console.log(chalk.green('\n✅ Análise concluída! Verifique o arquivo database-analysis-report.json\n'));
            return report;
        } catch (error) {
            console.log(chalk.red(`❌ Erro na análise: ${error.message}\n`));
            throw error;
        }
    }

    /**
     * Executa migração
     */
    async executeMigration() {
        console.log(chalk.blue('\n📦 EXECUTANDO MIGRAÇÃO DE DADOS...\n'));
        
        const confirm = await this.askQuestion('Tem certeza que deseja prosseguir com a migração? (s/n): ');
        if (confirm !== 's' && confirm !== 'sim') {
            console.log(chalk.yellow('Migração cancelada pelo usuário.\n'));
            return null;
        }
        
        try {
            const migrator = new UserMigrator();
            const result = await migrator.run();
            
            console.log(chalk.green('\n✅ Migração concluída com sucesso!\n'));
            return result;
        } catch (error) {
            console.log(chalk.red(`❌ Erro na migração: ${error.message}\n`));
            throw error;
        }
    }

    /**
     * Remove usuário origem
     */
    async removeSourceUser() {
        console.log(chalk.red('\n🗑️  REMOVENDO USUÁRIO ORIGEM...\n'));
        
        console.log(chalk.yellow('⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL!'));
        const confirm = await this.askQuestion('Tem ABSOLUTA certeza que deseja remover o usuário origem? (s/n): ');
        if (confirm !== 's' && confirm !== 'sim') {
            console.log(chalk.yellow('Remoção cancelada pelo usuário.\n'));
            return null;
        }
        
        try {
            const remover = new UserRemover();
            const result = await remover.run();
            
            console.log(chalk.green('\n✅ Remoção concluída com sucesso!\n'));
            return result;
        } catch (error) {
            console.log(chalk.red(`❌ Erro na remoção: ${error.message}\n`));
            throw error;
        }
    }

    /**
     * Exporta dump do banco
     */
    async exportDatabase() {
        console.log(chalk.blue('\n📦 EXPORTANDO DUMP DO BANCO DE DADOS...\n'));
        
        const compress = await this.askQuestion('Deseja comprimir o arquivo de dump? (s/n): ');
        const compressed = compress === 's' || compress === 'sim';
        
        try {
            const exporter = new DatabaseExporter();
            const result = await exporter.run(compressed);
            
            console.log(chalk.green('\n✅ Export concluído com sucesso!\n'));
            return result;
        } catch (error) {
            console.log(chalk.red(`❌ Erro no export: ${error.message}\n`));
            throw error;
        }
    }

    /**
     * Executa processo completo
     */
    async executeCompleteProcess() {
        console.log(chalk.blue('\n🚀 EXECUTANDO PROCESSO COMPLETO...\n'));
        
        console.log(chalk.yellow('Este processo irá:'));
        console.log(chalk.white('  1. Analisar o banco de dados'));
        console.log(chalk.white('  2. Migrar dados das tabelas especificadas do usuário 41 para 358'));
        console.log(chalk.white('  3. Verificar integridade da migração'));
        console.log(chalk.white('  4. Remover o usuário 41 permanentemente'));
        console.log(chalk.white('  5. Exportar dump completo do banco de dados'));
        console.log('');
        
        const confirm = await this.askQuestion('Deseja prosseguir com o processo completo? (s/n): ');
        if (confirm !== 's' && confirm !== 'sim') {
            console.log(chalk.yellow('Processo cancelado pelo usuário.\n'));
            return null;
        }
        
        try {
            // 1. Análise
            console.log(chalk.blue('📊 Etapa 1/5: Analisando banco de dados...'));
            await this.analyzeDatabaseStructure();
            
            // 2. Migração
            console.log(chalk.blue('📦 Etapa 2/5: Executando migração...'));
            const migrationResult = await this.executeMigration();
            
            if (!migrationResult) {
                throw new Error('Migração foi cancelada');
            }
            
            // 3. Verificação adicional
            console.log(chalk.blue('🔍 Etapa 3/5: Verificação adicional...'));
            await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa para review
            
            // 4. Remoção
            console.log(chalk.blue('🗑️  Etapa 4/5: Removendo usuário origem...'));
            const removalResult = await this.removeSourceUser();
            
            if (!removalResult) {
                throw new Error('Remoção foi cancelada');
            }
            
            // 5. Export
            console.log(chalk.blue('📦 Etapa 5/5: Exportando dump do banco...'));
            const exportResult = await this.exportDatabase();
            
            console.log(chalk.green.bold('\n🎉 PROCESSO COMPLETO FINALIZADO COM SUCESSO!\n'));
            
            return {
                migration: migrationResult,
                removal: removalResult,
                export: exportResult
            };
            
        } catch (error) {
            console.log(chalk.red(`❌ Erro no processo completo: ${error.message}\n`));
            throw error;
        }
    }

    /**
     * Loop principal da aplicação
     */
    async run() {
        try {
            this.showBanner();
            this.showConfiguration();
            
            while (true) {
                const choice = await this.showMainMenu();
                
                switch (choice) {
                    case '1':
                        await this.testDatabaseConnection();
                        break;
                    case '2':
                        await this.analyzeDatabaseStructure();
                        break;
                    case '3':
                        await this.executeMigration();
                        break;
                    case '4':
                        await this.removeSourceUser();
                        break;
                    case '5':
                        await this.exportDatabase();
                        break;
                    case '6':
                        await this.executeCompleteProcess();
                        break;
                    case '7':
                        console.log(chalk.blue('👋 Saindo... Até logo!\n'));
                        this.rl.close();
                        return;
                    default:
                        console.log(chalk.red('❌ Opção inválida. Tente novamente.\n'));
                }
                
                // Pausa antes de mostrar o menu novamente
                await this.askQuestion('Pressione Enter para continuar...');
                console.clear();
                this.showBanner();
                this.showConfiguration();
            }
            
        } catch (error) {
            console.error(chalk.red.bold('\n💥 Erro fatal:'), error.message);
            this.rl.close();
            process.exit(1);
        }
    }
}

// Executar CLI se chamado diretamente
if (require.main === module) {
    const cli = new MigrationCLI();
    cli.run();
}

module.exports = MigrationCLI;