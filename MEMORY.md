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
- [x] **Sistema de Notificações Unificado (SQL):** Migração completa do sistema de notificações (sino) para a tabela relacional `notificacoes`, eliminando a dependência do JSON legado.
- [x] **Alertas de Avaliações:** Implementado disparo automático de notificações SQL e WhatsApp (via Evolution API) para turmas inteiras ao publicar exames/atividades.
- [x] **Justificativas Relacionais:** Notificações de justificativas de falta enviadas pelo Portal agora são salvas diretamente no PostgreSQL (aluno_id = 'admin').
- [x] **Intelligent Polling Admin:** O Admin Bell agora utiliza polling de 30s para sincronização em tempo real com o banco SQL, garantindo que novos alertas apareçam instantaneamente.
- [x] **Lixeira de Avaliações (Soft Delete):** Implementada aba de "Lixeira" no Manager que oculta provas sem deletar dados, preservando as notas no Boletim e no Portal.
- [x] **Unificação da Média Aritmética:** Refatorados `ReportCard.tsx` (Manager) e `Notas.tsx` (Portal) para calcular médias aritméticas reais (Média das Médias) em todos os níveis.
- [x] **Sincronização de Notas Órfãs:** Garantido que notas de provas deletadas/arquivadas permaneçam visíveis com seus respectivos títulos no Manager e Portal.
- [x] **Correção de Polling e Conflitos:** Ajustado timestamp `lastUpdated` para evitar sobrescritas de dados durante a sincronização em segundo plano.
- [x] **Git Push Realizado:** Todas as alterações de arquitetura de notas e exclusão lógica foram versionadas e enviadas ao repositório remoto.
- [x] **Correção do Sync Status:** Resolvido loop infinito no `index.tsx` que travava o status em "syncing" ao sincronizar o `lastUpdated` com o servidor.
- [x] **Blindagem de Fuso Horário (Postgres):** Rota de frequência do portal atualizada para usar `TO_CHAR` no SQL, eliminando deslocamentos de horas causados pela conversão UTC automática do driver.
- [x] **Unificação de Janela de Presença:** Portal e Manager agora utilizam a mesma janela de 30 minutos de tolerância para correlacionar presenças e faltas às aulas.
- [x] **Sincronia de Estatísticas (Portal):** O cálculo de porcentagem no Dashboard do Portal agora usa o mesmo motor lógico da página de Frequência, garantindo números idênticos.
- [x] **Consolidação do Modelo Relacional (Notas):** Confirmado que o módulo de Notas/Boletim é o primeiro 100% SQL, servindo de template para futuras migrações. O JSON `school_data.grades` foi oficialmente substituído pela tabela `notas_boletim`.
- [x] **Unificação de Pauta (Deduplicação):** Implementado filtro de deduplicação de aulas no Portal (`Frequencia.tsx` e `Dashboard.tsx`) para ignorar aulas conflitantes, igualando os totais aos do Admin.
- [x] **Regra de Registro Único:** Portal agora exibe apenas a primeira batida válida por aula, eliminando duplicidade visual de biometria.
- [x] **Sincronia de Justificativas:** Ajustada a contagem matemática do Portal para contabilizar faltas justificadas apenas após o aceite do Admin.
- [x] **Fix Dashboard Crash:** Corrigido erro de "tela preta" no Dashboard causado por acesso inseguro a propriedades nulas durante falhas de API.
- [x] **Blindagem de Conversão ISO:** Resolvida falha crítica de `RangeError: Invalid time value` em todo o Portal. Agora o sistema ignora datas corrompidas ou inválidas em vez de quebrar a interface inteira.
- [x] **Resolução de ReferenceError:** Identificada e corrigida a causa raiz da tela preta persistente (variáveis não declaradas após refatoração da pauta).
- [x] **Auditoria TypeScript:** Realizada varredura total com `tsc` no Portal, corrigindo todos os erros de tipagem remanescentes em Notas e Avaliações para garantir estabilidade absoluta.
- [x] **Paridade Lógica Absoluta (Frequência):** A lógica de matching de frequência do Portal (`Frequencia.tsx` e `Dashboard.tsx`) agora é um clone 100% idêntico ao do Manager (`AttendanceQuery.tsx`).
- [x] **Fix Janela de Matching (Portal):** Corrigido bug onde aulas sem `endTime` fechavam a janela de presença prematuramente (fallback alterado de `00:00:00` para `23:59:00`).
- [x] **Resolução de Justificativas Invisíveis:** Justificativas enviadas agora são corretamente mapeadas às aulas no Portal através da sincronização de janelas de tempo e IDs.
- [x] **Correção do Fluxo de Exclusão (WhatsApp):** Ajustada a ordem de exclusão no `server.selfhosted.js` e `Finance.tsx`. A limpeza local agora ocorre apenas após o disparo bem-sucedido do WhatsApp via Webhook, garantindo que as variáveis `{nome}` e `{descricao}` nunca cheguem vazias.
- [x] **Feedback Real de Exclusão:** Implementado `showAlert` detalhado no Financeiro e confirmação real via **Sino de Notificações** (Admin) após o processamento do Webhook.
- [x] **Refinamento do Sino (AdminBell):** O botão "Ver Anexo" agora é exclusivo de notificações de justificativa que possuem arquivo físico, ocultando-se em notificações de sistema que usam o campo anexo para metadados JSON.
- [x] **Blindagem de UI (Financeiro):** Corrigido potencial erro de referência no parse de erro do Asaas que causava "White Screen" em exclusões negadas.

## 📋 Próximos Passos
- [ ] Iniciar a migração do módulo Financeiro para 100% SQL seguindo o padrão do Boletim.

- [ ] Módulo Financeiro SQL: Iniciar a migração total do financeiro para PostgreSQL (padrão `notas_boletim`).
- [x] **Correção de Notas (Boletim):** Resolvido bug de visibilidade onde as notas não apareciam devido a race conditions no carregamento e mapeamento incompleto do `examId`.
- [x] **Git Push Realizado:** Correções de deploy e visibilidade de notas enviadas ao repositório.
- [ ] **Monitoramento:** Validar a exibição das notas após o reinício dos containers.
- [ ] Otimização de Build: Re-explorar o cache do Docker.

## 📅 Histórico Anterior (06/05/2026 - 08/05/2026)
- [x] Estabilização de CI/CD: Transição para `runs-on: self-hosted` (ARM64 nativo) eliminando lentidão e crashes do QEMU.
- [x] Correção do Sino de Notificações: Botões sempre visíveis, suporte a anexo via chave `arquivo` e exibição do **Motivo da Falta** direto na lista do sino.
- [x] **Segurança Financeira:** Implementada trava de segurança (`isCreating`) contra cliques múltiplos em formulários financeiros, resolvendo a duplicidade de cobranças no Asaas.
- [x] **Boletim Detalhado (Manager):** Refatoração para suportar N avaliações por bimestre, com interface que diferencia Provas de Atividades.
- [x] **Ambiente de Provas (Portal):** Implementado modo imersivo com cronômetro pulsante (alerta vermelho < 1min) e etiquetas dinâmicas por tipo de avaliação.
- [x] **Envio em Massa V3:** Implementado suporte a anexos (PDF/Imagens), emojis e envio duplo (Aluno/Responsável).
- [x] **Resolução de Crash:** Removida a dependência `node-fetch` que causava erro 404 no deploy de produção.
- [x] **Financeiro Mobile:** Otimização da interface para melhor responsividade e compactação de botões.
- [x] **Boletim:** Implementada filtragem para exibir apenas avaliações com submissões ativas.
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

### 📅 08/05/2026 - Estabilização Crítica de Automação e Sincronia Financeira
- **Fonte de Disparos:** A rotina de cobranças agora utiliza o `school_data.payments` (JSON) como fonte primária, mas com **Sincronização Reversa** ativa (SQL -> JSON).
- **Sincronização Bidirecional (Webhook):** O webhook do Asaas atualiza o SQL e o JSON em tempo real.
- **Resolução de Fantasmas:** Refinada a lógica de sincronia no Financeiro para atualizar apenas mudanças de status reais, eliminando o aviso persistente de "96 atualizações".
- **Inteligência de Mensagens:** O sistema agora garante que lembretes preventivos NUNCA sejam enviados para boletos já pagos no SQL/JSON.
- **Integridade Numérica:** Casting explícito para `Number()` em todo o fluxo financeiro.

### 📢 Automação de Mensagens
- [x] **Estabilização de Lembretes (V2):** Resolvido bug de deslocamento de fuso horário (-1 dia) nas datas de vencimento. Implementadas ferramentas de debug (ignorar trava diária e reset de contadores) e **controle manual de delay para disparos em massa** para facilitar testes e garantir segurança contra banimento.
- [x] **Filtragem Inteligente de Boletim:** Refatorada a aba de Boletim no Manager para exibir provas e atividades apenas quando houver submissão do aluno, eliminando a poluição visual de outras turmas.
- [x] **Otimização Financeira (Mobile):** Cabeçalho da aba Financeiro redesenhado para ser 100% responsivo, com botões compactos e ícones inteligentes que economizam espaço em dispositivos móveis.
- [x] **Disparo em Massa V3:** Implementada lógica de primeiro nome (`.split(' ')[0]`), envio simultâneo para Aluno e Responsável (quando contatos forem diferentes), painel de 25 emojis temáticos e suporte a anexos (Imagem/PDF) via Evolution API.

## 📋 Próximos Passos Pendentes

1. **Módulo Financeiro SQL:** Iniciar a migração total do financeiro para PostgreSQL (padrão `notas_boletim`).
2. **Otimização de Build:** Re-explorar o cache do Docker.
3. **Financeiro:** Implementar visualização de extrato detalhado.

**Nota Técnica:** O arquivo `server.js` deve ser mantido como espelho ou ignorado conforme orientação do usuário, com foco total no `server.selfhosted.js`.
