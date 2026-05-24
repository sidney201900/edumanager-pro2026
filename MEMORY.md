# Log de Migração SQL-First (Fase 5/6: Aulas, Frequências e Contratos)

## Resumo das Modificações
Nesta sessão, focamos em remover a exclusividade do arquivo `school_data.json` nos módulos de Cronograma (Aulas), Frequências e Contratos (incluindo Modelos de Contrato).

### 1. Banco de Dados e Backend (Manager)
- Adicionados métodos CRUD no arquivo `manager/services/database.js` para as tabelas `aulas`, `contratos` e `modelos_contrato`.
- Expostos endpoints em `manager/server.selfhosted.js`:
  - `/api/aulas` (GET) e `/api/aulas/lote` (POST, DELETE)
  - `/api/modelos-contrato` (GET, POST, PUT, DELETE)
  - `/api/contratos` (GET, POST, DELETE)
- **Sincronização Injetada:** Modificada a função `syncJsonToRelationalTables` para iterar sobre `schoolData.lessons`, `schoolData.attendance`, `schoolData.contracts` e `schoolData.contractTemplates`, executando `INSERT ... ON CONFLICT DO UPDATE`. Isso garante que operações híbridas (que salvam JSON no Frontend) sejam espelhadas instantaneamente no PostgreSQL.

### 2. Frontend (Manager)
- `LessonSchedule.tsx` (Cronograma): Refatorado para carregar as aulas ( `fetch('/api/aulas')`) em estado próprio (`dbLessons`), removendo a leitura estática de `data.lessons`. Todas as ações (gerar aulas, reagendar, cancelar e exclusão em lote) agora enviam chamadas à API antes de atualizar a UI e invocar o `saveData`.
- `Contracts.tsx` (Contratos): Refatorado para utilizar estados locais (`dbContracts` e `dbTemplates`) carregados das novas rotas de API. Criações e exclusões realizam requests HTTP para persistir os dados nativamente no SQL, mantendo compatibilidade com o formato JSON da UI base.

### 3. Portal do Aluno
- **`GET /api/portal/aulas`**: Alterada a rota para fazer um `SELECT` direto na tabela `aulas`, cruzando os IDs de turma vinculados ao aluno (via tabela `alunos` e histórico em `frequencias`). Adicionado fallback para ler o JSON caso o banco retorne vazio (útil durante a janela de transição).
- **`GET /api/portal/contratos`**: Alterada a rota para fazer um `SELECT` na tabela `contratos` puxando pelos dados salvos, com fallback seguro para o JSON se necessário.

## Impacto
O Portal do Aluno agora opera primordialmente com PostgreSQL para a maior parte de sua leitura, incluindo alunos, provas, aulas, frequências e contratos. O painel administrativo foi fortalecido, registrando operações nos dois bancos simultaneamente para evitar a temida "Tela Branca" durante leituras em cascata no dashboard antigo.
