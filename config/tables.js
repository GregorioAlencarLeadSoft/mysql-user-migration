/**
 * Configuração das tabelas específicas para migração
 * Definidas pelo usuário para o projeto fiesto18_database
 */

const MIGRATION_TABLES = [
    // { table: 'comment', column: 'user' },
    { table: 'content', column: 'user_id' },
    { table: 'media', column: 'user_id' },
    // { table: 'order', column: 'user' },
    // { table: 'suborder', column: 'user' }
];

/**
 * Retorna a lista de tabelas para migração
 */
const getMigrationTables = () => {
    return MIGRATION_TABLES;
};

/**
 * Verifica se uma tabela está na lista de migração
 */
const isTableIncluded = (tableName) => {
    return MIGRATION_TABLES.some(t => t.table === tableName);
};

/**
 * Retorna a coluna de user_id para uma tabela específica
 */
const getUserColumnForTable = (tableName) => {
    const tableConfig = MIGRATION_TABLES.find(t => t.table === tableName);
    return tableConfig ? tableConfig.column : null;
};

/**
 * Valida se todas as tabelas especificadas existem no banco
 */
const validateTablesExist = async (pool) => {
    const results = {};
    
    for (const tableConfig of MIGRATION_TABLES) {
        try {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                [process.env.DB_NAME, tableConfig.table]
            );
            
            results[tableConfig.table] = {
                exists: rows[0].count > 0,
                column: tableConfig.column
            };
        } catch (error) {
            results[tableConfig.table] = {
                exists: false,
                error: error.message,
                column: tableConfig.column
            };
        }
    }
    
    return results;
};

/**
 * Valida se as colunas especificadas existem nas tabelas
 */
const validateColumnsExist = async (pool) => {
    const results = {};
    
    for (const tableConfig of MIGRATION_TABLES) {
        try {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, tableConfig.table, tableConfig.column]
            );
            
            results[tableConfig.table] = {
                columnExists: rows[0].count > 0,
                column: tableConfig.column
            };
        } catch (error) {
            results[tableConfig.table] = {
                columnExists: false,
                error: error.message,
                column: tableConfig.column
            };
        }
    }
    
    return results;
};

module.exports = {
    MIGRATION_TABLES,
    getMigrationTables,
    isTableIncluded,
    getUserColumnForTable,
    validateTablesExist,
    validateColumnsExist
};

