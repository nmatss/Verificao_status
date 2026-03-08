# Verificacao de Status - Certificacao de Produtos

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

Sistema de verificacao automatizada do status de certificacao de produtos nas marcas Imaginarium, Puket e Puket Escolares. Compara dados de uma planilha de controle (Excel/Google Sheets) com as informacoes publicadas no e-commerce, gerando relatorios de inconsistencias.

## Funcionalidades

- **Leitura de dados**: Importa produtos a partir de planilha Excel ou Google Sheets
- **Scraping de e-commerce**: Acessa URLs dos produtos e extrai texto de certificacao publicado
- **Comparacao automatica**: Compara certificacao esperada vs. publicada com score de similaridade
- **Verificacao por IA**: Validacao opcional usando Claude (via OpenRouter) para casos ambiguos
- **Geracao de relatorios**: Relatorios detalhados com status por produto (OK, MISSING, INCONSISTENT)
- **Dashboard web**: Interface Next.js com graficos, filtros e visao geral do status
- **API REST**: Backend FastAPI com endpoints para consulta, agendamento e execucao de verificacoes
- **Agendamento**: Scheduler integrado para verificacoes periodicas
- **Autenticacao**: Login via Google OAuth restrito por dominio corporativo

## Stack Tecnologica

### Backend
- **Python 3**, FastAPI, Uvicorn
- **openpyxl**, **pandas** - Leitura de planilhas
- **gspread** - Integracao com Google Sheets
- **requests** - Scraping de paginas de produto
- **rich** - Output formatado no terminal
- **click** - Interface CLI

### Frontend (Dashboard)
- **Next.js 16**, React 19, TypeScript
- **Tailwind CSS 4**, Radix UI, shadcn/ui
- **Recharts** - Graficos e visualizacoes
- **NextAuth** - Autenticacao via Google OAuth

## Como Executar

### Pre-requisitos

- Python 3.8+
- Node.js 18+
- Credenciais Google (Service Account para Sheets, OAuth para Dashboard)

### Configuracao do Backend

```bash
# Instalar dependencias Python
cd verificacao_certificacao
pip install -r requirements.txt

# Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

### Configuracao do Dashboard

```bash
cd dashboard
npm install

# Configurar variaveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais
```

### Executar Tudo

```bash
# Usar o script de inicializacao (sobe backend + frontend)
./start.sh
```

Ou individualmente:

```bash
# Backend (porta 8000)
python3 -m uvicorn verificacao_certificacao.api_server:app --host 0.0.0.0 --port 8000 --reload

# Frontend (porta 3000)
cd dashboard && npm run dev
```

## Variaveis de Ambiente

### Backend (`verificacao_certificacao/.env`)

| Variavel | Descricao |
|----------|-----------|
| `GOOGLE_SHEETS_ID` | ID da planilha Google Sheets |
| `GOOGLE_CREDENTIALS_FILE` | Caminho do arquivo de credenciais Google |
| `OPENROUTER_API_KEY` | Chave da API OpenRouter (opcional, para verificacao IA) |
| `OPENROUTER_MODEL` | Modelo de IA a utilizar (opcional) |

### Dashboard (`dashboard/.env.local`)

| Variavel | Descricao |
|----------|-----------|
| `AUTH_SECRET` | Secret para NextAuth |
| `AUTH_URL` | URL base do dashboard |
| `GOOGLE_CLIENT_ID` | Client ID do Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google OAuth |
| `ALLOWED_DOMAIN` | Dominio permitido para login |
| `ADMIN_EMAILS` | Emails dos administradores |
| `NEXT_PUBLIC_API_URL` | URL do backend Python |

## Estrutura do Projeto

```
Verificao_status/
├── verificacao_certificacao/    # Backend Python
│   ├── api_server.py           # Servidor FastAPI
│   ├── main.py                 # CLI principal
│   ├── scraper.py              # Scraping de e-commerce
│   ├── comparator.py           # Comparacao de certificacoes
│   ├── ai_verifier.py          # Verificacao por IA
│   ├── excel_reader.py         # Leitura de Excel
│   ├── sheets_reader.py        # Leitura de Google Sheets
│   ├── url_resolver.py         # Resolucao de URLs
│   ├── report_generator.py     # Geracao de relatorios
│   ├── scheduler.py            # Agendamento de tarefas
│   ├── models.py               # Modelos de dados
│   ├── config.py               # Configuracoes
│   └── requirements.txt
├── dashboard/                  # Frontend Next.js
│   ├── src/
│   ├── package.json
│   └── .env.example
├── data/                       # Dados locais (SQLite)
├── start.sh                    # Script de inicializacao
└── .gitignore
```
