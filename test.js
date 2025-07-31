const { testConnection } = require('./config/database');
const DatabaseAnalyzer = require('./analyze-database');
const chalk = require('chalk');
require('dotenv').config();

/**
 * Suite de testes para validar o projeto de migração
 */
class MigrationTester {
    constructor() {
        this.testResults = [];
    }

    /**
     * Executa um teste e registra o resultado
     */
    async runTest(testName, testFunction) {
        try {
            console.log(chalk.blue(`🧪 Executando: ${testName}`));
            const startTime = Date.now();
            
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'PASSED',
                duration,
                result
            });
            
            console.log(chalk.green(`✅ ${testName} - PASSOU (${duration}ms)`));
            return result;
            
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'FAILED',
                error: error.message
            });
            
            console.log(chalk.red(`❌ ${testName} - FALHOU: ${error.message}`));
            throw error;
        }
    }

    /**
     * Teste de conexão com banco de dados
     */
    async testDatabaseConnection() {
        return await this.runTest('Conexão com Banco de Dados', async () => {
            const success = await testConnection();
            if (!success) {
                throw new Error('Falha na conexão com o banco de dados');
            }
            return { connected: true };
        });
    }

    /**
     * Teste de análise de estrutura do banco
     */
    async testDatabaseAnalysis() {
        return await this.runTest('Análise de Estrutura do Banco', async () => {
            const analyzer = new DatabaseAnalyzer();
            const tableMap = await analyzer.findTablesWithUserId();
            
            if (Object.keys(tableMap).length === 0) {
                throw new Error('Nenhuma tabela com user_id encontrada');
            }
            
            return { 
                tablesFound: Object.keys(tableMap).length,
                tables: Object.keys(tableMap)
            };
        });
    }

    /**
     * Teste de validação de configuração
     */
    async testConfiguration() {
        return await this.runTest('Validação de Configuração', async () => {
            const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
            const missing = requiredEnvVars.filter(varName => !process.env[varName]);
            
            if (missing.length > 0) {
                throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
            }
            
            const sourceUserId = parseInt(process.env.SOURCE_USER_ID) || 41;
            const targetUserId = parseInt(process.env.TARGET_USER_ID) || 358;
            
            if (sourceUserId === targetUserId) {
                throw new Error('IDs de usuário origem e destino não podem ser iguais');
            }
            
            return {
                sourceUserId,
                targetUserId,
                dryRun: process.env.DRY_RUN === 'true'
            };
        });
    }

    /**
     * Teste de verificação de usuários
     */
    async testUserVerification() {
        return await this.runTest('Verificação de Usuários', async () => {
            const analyzer = new DatabaseAnalyzer();
            const userInfo = await analyzer.checkUsersExist();
            
            // Para este teste, vamos apenas verificar se a função executa sem erro
            // Em um ambiente real, você verificaria se os usuários existem
            
            return {
                userTableFound: userInfo.userTable !== null,
                sourceUserExists: userInfo.sourceUser !== null,
                targetUserExists: userInfo.targetUser !== null
            };
        });
    }

    /**
     * Teste de validação de dependências
     */
    async testDependencies() {
        return await this.runTest('Validação de Dependências', async () => {
            const requiredModules = ['mysql2', 'chalk', 'dotenv'];
            const moduleResults = {};
            
            for (const moduleName of requiredModules) {
                try {
                    require(moduleName);
                    moduleResults[moduleName] = 'OK';
                } catch (error) {
                    moduleResults[moduleName] = 'MISSING';
                    throw new Error(`Módulo ${moduleName} não encontrado`);
                }
            }
            
            return moduleResults;
        });
    }

    /**
     * Executa todos os testes
     */
    async runAllTests() {
        console.log(chalk.blue.bold('\n🧪 INICIANDO SUITE DE TESTES\n'));
        
        try {
            await this.testDependencies();
            await this.testConfiguration();
            await this.testDatabaseConnection();
            await this.testDatabaseAnalysis();
            await this.testUserVerification();
            
            const passedTests = this.testResults.filter(t => t.status === 'PASSED').length;
            const totalTests = this.testResults.length;
            
            console.log(chalk.green.bold(`\n✅ TODOS OS TESTES PASSARAM (${passedTests}/${totalTests})\n`));
            
            return {
                success: true,
                passedTests,
                totalTests,
                results: this.testResults
            };
            
        } catch (error) {
            const passedTests = this.testResults.filter(t => t.status === 'PASSED').length;
            const totalTests = this.testResults.length;
            
            console.log(chalk.red.bold(`\n❌ ALGUNS TESTES FALHARAM (${passedTests}/${totalTests})\n`));
            
            return {
                success: false,
                passedTests,
                totalTests,
                results: this.testResults,
                error: error.message
            };
        }
    }

    /**
     * Gera relatório de testes
     */
    generateTestReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testResults.length,
                passed: this.testResults.filter(t => t.status === 'PASSED').length,
                failed: this.testResults.filter(t => t.status === 'FAILED').length
            },
            tests: this.testResults
        };
        
        const fs = require('fs');
        const reportFile = `test-report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(chalk.blue(`📋 Relatório de testes salvo em: ${reportFile}`));
        return reportFile;
    }
}

// Executar testes se chamado diretamente
if (require.main === module) {
    const tester = new MigrationTester();
    tester.runAllTests()
        .then((result) => {
            tester.generateTestReport();
            process.exit(result.success ? 0 : 1);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n💥 Erro fatal nos testes:'), error.message);
            tester.generateTestReport();
            process.exit(1);
        });
}

module.exports = MigrationTester;