# MEMORY.md - Contexto de Desenvolvimento

> [!CAUTION]
> **Git Push Proibido Sem Demanda Explícita:**
> NUNCA execute `git add`, `git commit` ou `git push` sem que o USUÁRIO solicite explicitamente. Alterações devem ser feitas nos arquivos, mas o envio ao repositório remoto é uma ação exclusiva do usuário. Aguarde sempre o comando direto do usuário para realizar qualquer operação de versionamento.
> **ESTA REGRA É INVIOLÁVEL E O ASSISTENTE JÁ FALHOU NELA ANTERIORMENTE. NÃO REPITA O ERRO.**

- [x] **Correção Estrutural (Boletim):** Resolvida divergência de tabelas entre `notas` e `notas_boletim` no Manager, restaurando a exibição de médias.
- [x] **Frequência Analítica (Portal):** Cards de estatísticas (Presença/Falta) agora usam a mesma lógica da lista (considerando `verified` e justificativas).
- [x] **Nova Métrica de Justificativas:** Adicionado card exclusivo no Portal para acompanhamento de justificativas enviadas.
- [x] **Detalhamento de Progresso de Aulas:** Card de "Total de Aulas" agora exibe aulas concluídas e aulas a concluir.
- [x] **Migração Relacional de Frequência:** Portal migrado para ler frequências diretamente da tabela SQL `frequencias`. **VERIFICADO.**
- [x] **Sincronização Bidirecional (Frequência):** Garantido que justificativas enviadas pelo Portal atualizem instantaneamente a tabela relacional via `ON CONFLICT`.
- [x] **Auto-Migração de Esquema:** Implementada lógica de auto-correção de colunas (`ALTER TABLE`) na rotina de sincronização do banco de dados (`database.js`).
- [x] **Fechamento Automático de Pauta:** Implementada rotina `processAutoAbsences` que gera registros físicos de falta para aulas passadas sem registro, garantindo consistência entre Portal e Manager.
- [ ] Próximo Passo: Expandir a migração relacional para o módulo de "Minhas Aulas" no Portal para manter a consistência arquitetural.



## 📅 Histórico Anterior (22/04/2026)

- [x] Correção do "Bug da Tela Preta" na câmera ao alternar para câmera traseira no celular.
- [x] Unificação do servidor de produção: Dockerfile agora utiliza `server.selfhosted.js` (Manager e Portal).
- [x] Correção dos Cards de Monitoramento (PostgreSQL/MinIO) com tratativa de erro independente.
- [x] Vacina de cache global: Injeção de `normalizePhotoUrl` nos módulos de Boletim, Turmas e Frequência.
- [x] Estabilização do Build ARM64: Injeção de `max_old_space_size=4096` nos Dockerfiles para evitar crashes do Vite no Github Actions.
- [x] Correção de Rota Express 5: Migração de curingas `*` para Regex para evitar falhas de inicialização no servidor.
- [x] Correção do Crash 404 no Portal: Injeção da pasta `src/services` no container de produção para permitir o import do `storage.js`.
- [x] Correção das Imagens de Prova: Normalização das URLs nas questões de avaliações (Portal e Manager).
- [x] Estabilização de CI/CD: Transição para `runs-on: self-hosted` (ARM64 nativo) eliminando lentidão e crashes do QEMU.
- [x] Correção do Sino de Notificações: Botões sempre visíveis, suporte a anexo via chave `arquivo` e exibição do **Motivo da Falta** direto na lista do sino.
- [x] **Segurança Financeira:** Implementada trava de segurança (`isCreating`) contra cliques múltiplos em formulários financeiros, resolvendo a duplicidade de cobranças no Asaas.
- [x] **Boletim Detalhado (Manager):** Refatoração para suportar N avaliações por bimestre, com interface que diferencia Provas de Atividades.
- [x] **Ambiente de Provas (Portal):** Implementado modo imersivo com cronômetro pulsante (alerta vermelho < 1min) e etiquetas dinâmicas por tipo de avaliação.
- [x] **Boletim Analítico (Portal):** Nova interface de notas que mostra o extrato completo de cada avaliação realizada, separada por matéria e bimestre.
- [x] **Sincronia Total:** Integração via `examId` garantindo que notas do portal preencham automaticamente o boletim administrativo.
- [x] **Financeiro Inteligente:** Adicionado suporte ao tipo **"Apostila"** e grupo **"Taxas de Matrícula"** (buscadas dos cards de cursos). Implementado autocompletar inteligente que define o tipo de cobrança baseado na referência selecionada.
- [x] **Storage Explorer (MinIO):** Criada interface de gerenciamento de arquivos que permite navegar por buckets (pastas), visualizar (lightbox), baixar e excluir arquivos físicos individualmente.
- [x] **Database Data Viewer:** Implementada a visualização de registros (linhas) diretamente no Database Explorer, com suporte a redimensionamento automático de colunas e truncamento de dados longos.
- [x] **Controle de Refação (Retake Policy):** Adicionado botão de cadeado nos cards de Avaliações para permitir ou bloquear que alunos refaçam provas no portal (Regra 15).
- [x] **UI de Avaliações:** Padronização dos botões de edição ("Editar Prova" vs "Editar Atividade") e adição de botão de exclusão rápida direto no card.
- [x] **Correção de Vínculo de Notas:** Garantido que o `examId` seja sempre salvo nas notas geradas pelo Portal para preenchimento automático do Boletim Escolar no Manager.
- [x] **Fix Memory Leak:** Removido `pool.on('error')` que estava dentro da rota `PUT /api/school-data`, acumulando listeners a cada salvamento.
- [x] **Fix SyntaxError (Backticks):** Corrigido erro de sintaxe com backticks escapados na rota do Database Explorer que impedia o servidor de iniciar.
- [x] **Fix Static Serving Duplicado:** Consolidada a entrega de arquivos estáticos (dist) no `manager/server.selfhosted.js`, eliminando o erro 404 em produção.
- [x] **TypeScript Cleanup:** Corrigidos erros de tipo `unknown` nos `reduce()` do ReportCard.tsx e removida função órfã `closeModal` do Settings.tsx.
- [x] **Interface Grade Tipada:** Adicionado `examId?: string` à interface `Grade` em `types.ts`, eliminando casts `as any` inseguros.
- [ ] Próximo Passo: Iniciar testes de estresse no servidor self-hosted para submissão massiva de fotos de frequência.

### 💳 Módulo Financeiro (Portal do Aluno)
- **Funcionalidades Implementadas:**
  - Cards de resumo (Total em Aberto, Pago, Parcelas).
  - Listagem inteligente de pagamentos com labels dinâmicas (ex: "Parcela 1/3").
  - Lógica de normalização de status: `pago`, `pendente`, `atrasado`, `cancelado`.
  - Integração dupla para boletos: busca via ID do Asaas e fallback por data/valor no Supabase.
  - Visualização de recibos via link externo ou modal de impressão local.
- **Onde paramos:** O sistema de filtros e ordenação está funcional, sincronizando com os parâmetros da URL.

### 📝 Módulo de Avaliações (Portal do Aluno)
- **Funcionalidades Implementadas:**
  - Tela de realização de provas e atividades online com cronômetro e suporte a imagens de apoio (MinIO).
  - **Autocorreção 100% Automática:** O backend do portal (`server.js`) recebe as respostas, compara com o gabarito (`correctOptionIndex`), calcula o percentual de acertos e a nota proporcional ao peso da prova (`finalScore`).
  - **Lançamento Automático no Boletim:** A nota calculada é salva no PostgreSQL (`provas_submissoes`) e injetada instantaneamente na tabela de notas (`grades`) do `school_data`.
  - Bloqueio inteligente contra dupla submissão da mesma prova.

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
- [x] **Exploradores de Infraestrutura:** Implementado acesso via botões nos cards de monitoramento para abrir janelas modais de exploração profunda (Arquivos e Banco de Dados) com navegação fluida e lightbox.

### 🚀 Infraestrutura e Deploy
- **Estado Atual:** Pipeline 100% estabilizado no GitHub Actions usando `self-hosted` runner (Oracle ARM64 nativo). 
- **Melhoria:** O build agora ocorre diretamente na arquitetura de destino, sem emulação QEMU, garantindo velocidade e estabilidade total.

## 📋 Próximos Passos Pendentes

1. **Concluída a Arquitetura de Storage Local (MinIO):** Todo o sistema (Tanto portal quanto manager) agora utiliza `FormData` para envio físico de arquivos aos servidores, salvando apenas a `URL pública` no banco de dados.
2. **Otimização de Build:** Re-explorar o cache do Docker ou considerar a remoção do suporte nativo ARM64 se não for estritamente necessário para o servidor final.
3. **Financeiro:** Implementar visualização de extrato detalhado e integração com gateway de pagamento direto via cartão.
