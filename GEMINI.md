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

## 🚨 Regras de Fluxo de Trabalho (CRÍTICO)

> [!CAUTION]
> **Git Push Proibido Sem Demanda Explícita:**
> NUNCA execute `git add`, `git commit` ou `git push` sem que o USUÁRIO solicite explicitamente. Alterações devem ser feitas nos arquivos, mas o envio ao repositório remoto é uma ação exclusiva do usuário. Aguarde sempre o comando direto do usuário para realizar qualquer operação de versionamento.
> **ESTA REGRA É INVIOLÁVEL E O ASSISTENTE JÁ FALHOU NELA EM 01/05/2026. NÃO REPITA O ERRO.**

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
10. **Justification Logic**: Attendance justifications MUST include `fromStudentId` in notification metadata and support both `arquivo` and `arquivo_base64` keys for attachment compatibility. Notifications SHOULD include the motive text in the `message` field (JSON format: `{text, motivo}`) to allow previews in the manager bell.
11. **Modal Standards**: System modals should utilize `bg-transparent` (no background darkening or blur) with `shadow-2xl` for depth, ensuring a clean and float-like aesthetic.
12. **Messages Automation**: Preventive reminders and overdue settings MUST be managed within their respective template modals (contextual logic), with independent manual triggers for each phase (Overdue vs. Upcoming).
13. **Grading & Evaluation Standards**: Assessments are categorized as `exam` (violet/violet labels) or `activity` (sky/blue labels). The report card (Boletim) MUST support multiple evaluations per period, showing the individual breakdown (name and value). The module MUST be named **"Atividades e Provas"** for clarity.
14. **Asaas Safety**: All financial generation forms MUST implement a loading state (`isCreating`) to disable submit buttons and prevent duplicate charges.
15. **Retake Policy**: Students ARE allowed to retake activities and exams. The system MUST implement a "Lock" (Cadeado) logic: if locked, the retake button is hidden; if unlocked, the button is visible and the new submission overwrites the previous grade.
16. **Financial Categories**: The system supports categories: `monthly` (Mensalidade), `registration` (Matrícula), `handout` (Apostila), and `others` (Outros). Automated forms must map references (Cursos -> monthly, Registration -> registration, Handout -> handout).
17. **Modal Floating Principle**: All system modals must avoid backdrop-blur and background overlays. Use `bg-transparent` for the fixed container and `bg-white` (solid) for the modal box, ensuring contrast via large soft shadows (`shadow-2xl` or equivalent).
18. **Automated Messaging (Cron Jobs)**: The system uses `node-cron` for independent message scheduling (Preventive vs. Overdue). Overdue logic MUST implement safety checks using `overdue_warnings_count` and `last_overdue_warning_at` to avoid spamming the student. Immediate webhook triggers for `PAYMENT_OVERDUE` are disabled in favor of scheduled routines.
19. **Numerical Data Integrity**: When retrieving data from PostgreSQL `NUMERIC` or `DECIMAL` columns, values MUST be explicitly cast to `Number()` in the backend before being sent to the frontend to prevent crashes when using `.toFixed()` in React.
20. **Exam Duplication**: The system supports cloning evaluations. Duplicated exams MUST default to `draft` status and include `(Cópia)` in the title to allow verification before deployment to new classes.

