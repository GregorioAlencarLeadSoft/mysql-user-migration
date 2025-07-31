const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Configuração da conexão com o banco de dados MySQL
 */
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'fiesto18_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

/** 
 * Cria um pool de conexões MySQL
 */
const createPool = () => {
    return mysql.createPool(dbConfig);
};

/**
 * Testa a conexão com o banco de dados
 */
const testConnection = async () => {
    let connection;
    try {
        const pool = createPool();
        connection = await pool.getConnection();
        console.log('✅ Conexão com o banco de dados estabelecida com sucesso');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com o banco de dados:', error.message);
        return false;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    dbConfig,
    createPool,
    testConnection
};

