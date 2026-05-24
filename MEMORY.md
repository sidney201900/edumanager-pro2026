# Log da Migração Massiva SQL-First (Sessão Completa)

## Visão Geral
Nesta sessão de trabalho, realizamos o "core" da transição do sistema EduManager, saindo do modelo puramente JSON (`school_data.json`) e consolidando 4 módulos centrais diretamente no Banco de Dados Relacional PostgreSQL.

## Módulos Migrados

### Fase 4: Gestão de Alunos e Autenticação
- **Backend Manager**: CRUD no `database.js` para tabela `alunos`, rotas `/api/alunos` no `server.selfhosted.js`.
- **Frontend Manager (`Students.tsx`)**: Refatorado para buscar via `fetch('/api/alunos')`.
- **Portal do Aluno**: Login (`/api/portal/login`) e perfil (`/api/portal/me`) reescritos para consultar a tabela `alunos` no PostgreSQL.

### Fase 5: Avaliações e Provas
- Backend e Frontend conectados às tabelas `provas` e `questoes_provas`.

### Fase 6: Cronograma e Aulas
- **Backend Manager**: Queries em lote (`insertAulas`, `getAulasByTurma`, `getAllAulas`, `deleteAulas`).
- **Frontend Manager (`LessonSchedule.tsx`)**: Consome `fetch('/api/aulas')` em estado próprio (`dbLessons`).
- **Frontend Manager (`Classes.tsx`)**: Ao criar/editar turma e gerar cronograma, agora envia aulas via `POST /api/aulas/lote` para o PostgreSQL.
- **Portal do Aluno**: Rota `/api/portal/aulas` faz `SELECT FROM aulas WHERE turma_id = ANY(...)`.

### Fase 7: Contratos e Modelos
- **Backend Manager**: CRUD para `contratos` e `modelos_contrato`.
- **Frontend Manager (`Contracts.tsx`)**: Consome `/api/contratos` e `/api/modelos-contrato`.
- **Portal do Aluno**: Rota `/api/portal/contratos` faz `SELECT FROM contratos WHERE aluno_id = $1`.

## Bugs Encontrados e Corrigidos

### 🐛 Bug 1: Tela Branca na Aba Alunos (`Students.tsx`)
- **Causa**: Referência circular no `useState` — `useState<any[]>(dbClasses || [])` referenciava a si mesma.
- **Fix**: Alterado para `useState<any[]>(data?.classes || [])`.

### 🐛 Bug 2: Dados Não Migrados para PostgreSQL
- **Causa**: A rotina `syncJsonToRelationalTables` só roda quando o Manager salva o JSON via `PUT /api/school-data`. Como a migração era nova, os dados nunca foram sincronizados.
- **Fix**: Criado script `migrate_aulas_contratos.cjs` que conecta diretamente ao PostgreSQL de produção e roda os INSERTs.
- **Resultado**: 109 aulas, 9 contratos, 1 modelo e 89 frequências migrados com sucesso.

### 🐛 Bug 3: Aulas Órfãs (FK Constraint)
- **Causa**: 57 aulas no JSON pertenciam a uma turma deletada (`d48b268c-...`), causando violação de FK.
- **Fix**: O script filtra aulas cujo `classId` não existe na tabela `turmas`.

### 🐛 Bug 4: Contratos Não Apareciam no Manager
- **Causa**: A função `getContratos()` retornava o campo como `date`, mas o frontend (`Contracts.tsx`) esperava `createdAt`.
- **Fix**: Corrigido o mapeamento em `database.js` para retornar `createdAt: r.created_at_fmt`.

### 🐛 Bug 5: Classes.tsx Não Salvava Aulas no PostgreSQL
- **Causa**: Ao criar/editar turma com cronograma, as aulas geradas eram salvas **apenas no JSON** (`data.lessons`), nunca no banco.
- **Fix**: Adicionado `fetch('/api/aulas/lote')` no `Classes.tsx` para enviar as aulas geradas ao PostgreSQL.

## Estado Final do Banco de Dados
| Tabela | Registros |
|---|---|
| alunos | 9 |
| aulas | 109 |
| contratos | 9 |
| frequencias | 89 |
| modelos_contrato | 1 |
| provas | 3 |
| turmas | 3 |

## Padrões de Arquitetura
1. **Reverse Sync (Mão Dupla)**: Frontend salva no SQL via API e mantém backup no JSON.
2. **Fallback Gradual**: Portal prioriza SQL, invoca JSON apenas se banco retornar vazio.
3. **Migração de Dados**: Executada via script Node.js conectando diretamente ao PostgreSQL de produção (host: `150.230.87.131`, user: `edumanager`).
