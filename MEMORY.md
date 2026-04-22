# MEMORY.md - Contexto de Desenvolvimento

## 📅 Estado Atual (22/04/2026)

- [x] Correção do "Bug da Tela Preta" na câmera ao alternar para câmera traseira no celular.
- [x] Unificação do servidor de produção: Dockerfile agora utiliza `server.selfhosted.js` (Manager e Portal).
- [x] Correção dos Cards de Monitoramento (PostgreSQL/MinIO) com tratativa de erro independente.
- [x] Vacina de cache global: Injeção de `normalizePhotoUrl` nos módulos de Boletim, Turmas e Frequência.
- [x] Estabilização do Build ARM64: Injeção de `max_old_space_size=4096` nos Dockerfiles para evitar crashes do Vite no Github Actions.
- [x] Correção de Rota Express 5: Migração de curingas `*` para Regex para evitar falhas de inicialização no servidor.
- [x] Correção do Crash 404 no Portal: Injeção da pasta `src/services` no container de produção para permitir o import do `storage.js`.
- [x] Correção das Imagens de Prova: Normalização das URLs nas questões de avaliações (Portal e Manager).
- [x] Estabilização de CI/CD: Transição para `runs-on: self-hosted` (ARM64 nativo) eliminando lentidão e crashes do QEMU.
- [x] Fix Tela Branca (Portal): Isolamento Físico absoluto do `storage.js` (SDK Backend) para pasta fora do `src` (server-only). Isso impede vazamentos de Node.js no navegador.
- [x] Correção Financeiro (Portal): Resolvido erros de renderização em `Financeiro.tsx` e inconsistência de tipos em `Notifications.ts`.
- [x] Pipeline Deploy: Ajustado volume do Docker no GitHub Actions de `~/.docker` para `$DOCKER_CONFIG` para compatibilidade total com o Runner.
- [x] Normalização de Imagens: Todas as fotos de alunos no Portal agora passam pela vacina `normalizePhotoUrl`.
- [ ] Próximo Passo: Verificar se o Watchtower sincronizou as imagens corretamente na produção.

### 💳 Módulo Financeiro (Portal do Aluno)
- **Funcionalidades Implementadas:**
  - Cards de resumo (Total em Aberto, Pago, Parcelas).
  - Listagem inteligente de pagamentos com labels dinâmicas (ex: "Parcela 1/3").
  - Lógica de normalização de status: `pago`, `pendente`, `atrasado`, `cancelado`.
  - Integração dupla para boletos: busca via ID do Asaas e fallback por data/valor no Supabase.
  - Visualização de recibos via link externo ou modal de impressão local.
- **Onde paramos:** O sistema de filtros e ordenação está funcional, sincronizando com os parâmetros da URL.

### ⚙️ Módulo de Configurações e Infra (Manager)
- **Arquitetura de Armazenamento:** Implementada a transição para **Self-Hosted Storage (MinIO)**. 
  - Extração de Base64 concluída com sucesso via `migrate_images_to_minio.ts`.
  - O banco de dados de produção (PostgreSQL Local) foi populado com sucesso absoluto na VPS através da rota `/api/migracao-remota` utilizando o script `injetar_magia.ts`.
  - O sistema agora é 100% Self-Hosted (PostgreSQL e MinIO próprios), sem dependência da nuvem do Supabase.
- **Funcionalidades de Configuração:**
  - Gestão multi-unidade (Alternância entre Matriz e Filiais).
  - Validação de CNPJ e busca automática via CEP.
  - Monitoramento de logs de API em tempo real.
- **Histórico de Estabilidade:**
  - O sistema voltou para o último estado "verde" conhecido.
- **Refatoração de Uploads (Missão 2):** 
  - [x] **Foto do Aluno (Manager):** Migrado de Base64 para envio via `FormData` direto ao MinIO no componente `Students.tsx`.
  - [x] **Logo da Escola (Settings):** Removido falback agressivo para base64 e isolado backend para upload exclusivo no bucket `logos`.
  - [x] **Imagens de Avaliações (Exams):** Ajustado para utilizar Rota isolada `form-data` para salvar no bucket `exames` do MinIO.
  - [x] **Atestados (Portal):** Refatorado portal (backend e view) para upload do arquivo binário e salvar a url pública no JSON associado.
  - [x] **Frequência e Biometria (AttendanceQuery):** Corrigido bug de contagem, deduplicação de aulas e janela de 30 minutos para validação facial.
  - [x] **Financeiro (Manager):** Migração total para API PostgreSQL local, eliminando o Supabase Sync que causava erros na aba financeira.
  - [x] **Telemetria do Sistema (Settings):** Cards reais de monitoramento de disco (Postgres) e objetos (MinIO).

### 🚀 Infraestrutura e Deploy
- **Estado Atual:** Pipeline 100% estabilizado no GitHub Actions usando `self-hosted` runner (Oracle ARM64 nativo). 
- **Melhoria:** O build agora ocorre diretamente na arquitetura de destino, sem emulação QEMU, garantindo velocidade e estabilidade total.

## 📋 Próximos Passos Pendentes

1. **Concluída a Arquitetura de Storage Local (MinIO):** Todo o sistema (Tanto portal quanto manager) agora utiliza `FormData` para envio físico de arquivos aos servidores, salvando apenas a `URL pública` no banco de dados.
2. **Otimização de Build:** Re-explorar o cache do Docker ou considerar a remoção do suporte nativo ARM64 se não for estritamente necessário para o servidor final.
3. **Financeiro:** Implementar visualização de extrato detalhado e integração com gateway de pagamento direto via cartão.
