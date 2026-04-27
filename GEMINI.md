# EduManager - Regras Globais e Escopo

## 🚀 Escopo do Projeto
**EduManager** é um Sistema de Gestão Escolar completo, focado em alta performance, usabilidade premium e automação de processos administrativos e acadêmicos.

## 🛠️ Stack Tecnológica
- **Frontend/Backend:** Remix (React)
- **Banco de Dados:** PostgreSQL (100% Local/Self-Hosted)
- **Storage Architecture**: 100% Self-Hosted (MinIO) - Decoupled from Supabase Cloud.
- **Image Serving**: All images are served via a backend proxy route (`/storage/:bucket/:key`) to ensure cross-origin compatibility and security.
- **Synchronization**: High-performance local API for bank reconciliation (Asaas).
- **Orquestração e CI/CD:** Portainer (Docker) com GitHub Actions via Self-Hosted Runner (Oracle ARM64 nativo) e Watchtower.
- **Production Entry Point**: All production deployments MUST use `server.selfhosted.js` renamed/copied as `server.js` in the Docker containers to ensure full local feature availability.

## ⚠️ Regras de Negócio Críticas (MANDATÓRIO)

> [!IMPORTANT]
> **Migração de Dados (Legado 'schoodat'):**
> Ao realizar a migração completa dos dados do sistema legado 'schoodat' para o nosso banco de dados local Postgres, **é terminantemente proibido alterar, resetar ou re-hashear as senhas existentes.**
> As credenciais devem ser mantidas exatamente como estão para garantir que o acesso dos usuários não seja interrompido.

## 📜 Padrões de Desenvolvimento
1. **Design System:** Estética Premium, Dark Mode por padrão (ou glassmorphism), micro-animações e ausência de placeholders.
2. **Segurança:** Todas as rotas sensíveis devem validar o token JWT local (via secrets do ambiente). Proibido usar Supabase SDK para lógica de autenticação ou sincronização no frontend.
3. **Resiliência:** Tratamento rigoroso de erros em chamadas de API de terceiros (Asaas, Evolution API).
4. **Upload de Arquivos:** Proibido o uso de Base64 para envio de novos arquivos ao servidor. Use obrigatoriamente `FormData` e envie o objeto `File/Blob` para as rotas de API que integram com o MinIO.
5. **Build & Deploy Stability:** O pipeline de deploy deve obrigatoriamente utilizar `runs-on: self-hosted` e compilar apenas a plataforma `linux/arm64` (sem emulação QEMU). A atualização da stack em produção deve ser automatizada via container transiente do Watchtower.
6. **Express Compatibility**: Avoid using raw `/*` wildcards in Express 5 routes; use Regex paths (`/^\/route\/(.+)$/`) for compatibility with `path-to-regexp` v8.
7. **Frontend Independence**: NEVER import files from `services/` or `server.js` directly into React components to prevent Node.js/SDK leakage (causes White Screen). Physical isolation is enforced: backend-only services (like MinIO/S3 storage) MUST stay outside the `src/` directory in Vite/React projects. Use `helpers.ts` for UI logic and standard `fetch` for API calls.
8. **Login Persistence**: Administrative sessions are persisted via `localStorage` ('edumanager_session'). The main entry point MUST validate the session on mount to ensure UX continuity.
9. **Real-time & Sync**: In self-hosted environments, use **Intelligent Polling (30s)** to synchronize notifications and critical data between Portal and Manager, as standard Supabase Realtime is disabled.
10. **Justification Logic**: Attendance justifications MUST include `fromStudentId` in notification metadata and support both `arquivo` and `arquivo_base64` keys for attachment compatibility.
