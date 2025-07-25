#!/bin/bash

# Script de instalação para o projeto de migração MySQL
# Autor: Manus AI

set -e

echo "🚀 Iniciando instalação do projeto de migração MySQL..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 20.0.0 ou superior."
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js versão $NODE_VERSION encontrada. Requer versão $REQUIRED_VERSION ou superior."
    exit 1
fi

echo "✅ Node.js versão $NODE_VERSION encontrada"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale npm."
    exit 1
fi

echo "✅ npm encontrado"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências instaladas com sucesso"
else
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

# Criar arquivo .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo de configuração .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado. Por favor, edite-o com suas configurações."
else
    echo "ℹ️  Arquivo .env já existe"
fi

# Tornar scripts executáveis
chmod +x index.js

# Executar testes básicos
echo "🧪 Executando testes básicos..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ Testes básicos passaram"
else
    echo "⚠️  Alguns testes falharam. Verifique a configuração."
fi

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Edite o arquivo .env com suas configurações de banco de dados"
echo "2. Execute 'npm start' para iniciar a interface"
echo "3. Ou execute 'node index.js' diretamente"
echo ""
echo "📚 Consulte o README.md para documentação completa"
echo ""

