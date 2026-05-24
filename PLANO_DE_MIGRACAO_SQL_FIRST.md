# PLANO DE MIGRAÇÃO SQL-FIRST: DESLIGAMENTO DO `school_data.json`

Este documento detalha o passo a passo seguro para transferirmos cada bloco de dados do arquivo `school_data.json` para o PostgreSQL. 
**Regra Inviolável:** Toda mudança será feita parte a parte. Primeiro criamos as rotas e migramos os dados. Depois trocamos a UI. Se algo falhar, o JSON continua lá como backup imediato.

---

## FASE 1: FUNCIONÁRIOS E PROFESSORES (Ponto de Partida)
**Objetivo:** Remover a dependência de `school_data.employees` e usar a tabela `funcionarios` e `categorias_funcionarios`.

- [ ] **Passo 1.1 (Backend):** Criar e expor as rotas REST (`GET`, `POST`, `PUT`, `DELETE` em `/api/funcionarios`) no arquivo `manager/server.selfhosted.js`.
- [ ] **Passo 1.2 (Dados):** Criar um script temporário para extrair todos os dados de `employees` do `school_data.json` e rodar um `INSERT` massivo na tabela `funcionarios` (mantendo os IDs intactos para não quebrar históricos).
- [ ] **Passo 1.3 (Frontend):** Atualizar o componente de Funcionários (`Employees.tsx`) para consumir o novo endpoint em vez da função antiga do contexto (`fetchFromCloud`/`saveToCloud`).
- [ ] **Passo 1.4 (Homologação):** Validar se listar, adicionar, editar e excluir funcionários estão funcionando e sendo salvos apenas no banco.

---

## FASE 2: CONFIGURAÇÕES, WHATSAPP E INTEGRAÇÕES
**Objetivo:** Eliminar `profile`, `evolutionConfig`, `messageTemplates` e `settings` do JSON. Usar as tabelas `configuracoes` e `usuarios` (Admin).

- [ ] **Passo 2.1 (Backend):** Criar rotas em `server.selfhosted.js` (`/api/configuracoes`) que leem as chaves (Key-Value) ou objetos diretamente do banco de dados.
- [ ] **Passo 2.2 (Dados):** Inserir os templates atuais de WhatsApp e configs gerais do JSON na tabela `configuracoes`.
- [ ] **Passo 2.3 (Backend - Automations):** Substituir em `server.selfhosted.js` todas as funções que dependem das instâncias da Evolution API para que consultem o SQL antes de enviar mensagens.
- [ ] **Passo 2.4 (Frontend):** Ajustar o componente de Configurações (`Settings.tsx`, `Messages.tsx`) para salvar no novo modelo relacional.

---

## FASE 3: CURSOS E TURMAS (Estrutura Pedagógica)
**Objetivo:** Livrar o sistema de `school_data.classes` e `school_data.courses`.

- [ ] **Passo 3.1 (Backend):** Criar endpoints isolados (`/api/cursos`, `/api/turmas`, `/api/disciplinas`) que retornem junções SQL prontas para alimentar listagens e dropdowns.
- [ ] **Passo 3.2 (Dados):** Migrar arrays de objetos de turmas e cursos para suas referidas tabelas.
- [ ] **Passo 3.3 (Frontend):** Modificar os componentes de Cursos e Turmas no Manager para consumir as APIs diretas. Garantir que o Dashboard e o Formulário de Alunos usem esses endpoints para compor os selects.

---

## FASE 4: ALUNOS (O Coração do Sistema)
**Objetivo:** Desvincular de vez o gigantesco array `school_data.students`. Usar a tabela `alunos`.

- [ ] **Passo 4.1 (Backend):** Construir as rotas pesadas do aluno (`/api/alunos`), suportando busca rápida (LIKE/ILIKE) e paginação.
- [ ] **Passo 4.2 (Dados):** Fazer script super sensível para iterar o array de `students`, parseando fotos (MinIO proxy) e gravando em PostgreSQL. 
- [ ] **Passo 4.3 (Frontend - Manager):** Refatorar `Students.tsx` para carregar a listagem e os detalhes do aluno via SQL.
- [ ] **Passo 4.4 (Frontend - Portal):** Alterar o portal para que ao se logar, o aluno puxe os dados do seu próprio perfil de `SELECT * FROM alunos WHERE id = $1`.

---

## FASE 5: AVALIAÇÕES (Provas, Questões e Gabaritos)
**Objetivo:** Libertar as provas da chave `school_data.exams`. 

- [ ] **Passo 5.1 (Backend):** Configurar endpoints para carregar a Prova + Questões em uma única requisição. 
- [ ] **Passo 5.2 (Dados):** Migrar o `exams` e `activities` separando o escopo da avaliação e as perguntas vinculadas (`questoes_provas`).
- [ ] **Passo 5.3 (Frontend):** Modificar o módulo de criação de provas e a sala virtual de provas do aluno para ler os blocos diretamente do Postgres.

---

## FASE 6: FINALIZAÇÃO (Extinção do JSON)
**Objetivo:** Cortar as últimas raízes do `school_data.json` e declarar 100% migrado.

- [ ] **Passo 6.1 (Financeiro Final):** Desligar totalmente a função `syncJsonToRelationalTables`. O Portal dos Alunos passa a ler `alunos_cobrancas` diretamente (já fazemos isso no Manager). Extinguir os recebimentos antigos (`school_data.payments`).
- [ ] **Passo 6.2:** Remover a rota genérica `GET /api/school-data` e `PUT /api/school-data` do projeto inteiro.
- [ ] **Passo 6.3:** Realizar limpeza no arquivo físico do backend. O sistema agora é livre, ultra-rápido, relacional e profissionalmente 100% em SQL PostgreSQL.
