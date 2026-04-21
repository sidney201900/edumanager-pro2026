# EduManager - Regras Globais e Escopo

## 🚀 Escopo do Projeto
**EduManager** é um Sistema de Gestão Escolar completo, focado em alta performance, usabilidade premium e automação de processos administrativos e acadêmicos.

## 🛠️ Stack Tecnológica
- **Frontend/Backend:** Remix (React)
- **Banco de Dados:** PostgreSQL (Local e Nuvem via Supabase)
- **Arquitetura de Storage:** Self-Hosted (MinIO) via API HTTP customizada (bypass do SDK Supabase para arquivos).
- **Infraestrutura Cloud:** Supabase (Auth, Database Sync)
- **Orquestração:** Portainer (Docker)

## ⚠️ Regras de Negócio Críticas (MANDATÓRIO)

> [!IMPORTANT]
> **Migração de Dados (Legado 'schoodat'):**
> Ao realizar a migração completa dos dados do sistema legado 'schoodat' para o nosso banco de dados local Postgres, **é terminantemente proibido alterar, resetar ou re-hashear as senhas existentes.**
> As credenciais devem ser mantidas exatamente como estão para garantir que o acesso dos usuários não seja interrompido.

## 📜 Padrões de Desenvolvimento
1. **Design System:** Estética Premium, Dark Mode por padrão (ou glassmorphism), micro-animações e ausência de placeholders.
2. **Segurança:** Todas as rotas sensíveis devem validar o token do Supabase.
3. **Resiliência:** Tratamento rigoroso de erros em chamadas de API de terceiros (Asaas, Evolution API).
