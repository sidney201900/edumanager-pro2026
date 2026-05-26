# 📊 Tabela de Migração SQL-First — EduManager

> **Última atualização:** 25/05/2026 às 19:17 (BRT)
> 
> Este documento rastreia o progresso da migração de cada módulo do sistema legado JSON (`school_data` no PostgreSQL) para tabelas relacionais estruturadas com arquitetura **SQL-First**.

---

## Legenda de Status

| Ícone | Significado |
|:---:|:---|
| 🟢 | **100% SQL-First** — Leitura e escrita diretamente no PostgreSQL. JSON atualizado apenas por reverse-sync no backend para compatibilidade. |
| 🟡 | **Híbrido / Em Transição** — Backend já usa SQL, mas o frontend ainda depende parcialmente do contexto JSON. |
| 🔴 | **Pendente** — Módulo ainda opera 100% via JSON blob. |

---

## Tabela Completa

| Módulo | Chave no JSON (`school_data`) | Tabela PostgreSQL | Leitura no Manager (Admin) | Escrita no Manager (Admin) | Leitura no Portal (Aluno) | Status Atual |
|:---|:---|:---|:---|:---|:---|:---|
| **Alunos** | `students` | `alunos` | SQL Estruturado (`GET /api/alunos` → estado `dbStudents`) | SQL Estruturado (`POST`/`PUT`/`DELETE` `/api/alunos` e `PATCH /api/alunos/:id/rematricular`) | SQL Estruturado (Query direta no Postgres) | 🟢 **100% SQL-First** — Zero chamadas `dbService.saveData` no frontend. Reverse-sync automático no backend. |
| **Financeiro (Cobranças)** | `payments` | `alunos_cobrancas` | SQL Estruturado (`/api/admin/cobrancas`) | SQL Estruturado (`/api/gerar_cobranca` / `/api/excluir_cobranca`) | SQL Estruturado (com Fallback no JSON) | 🟢 **100% SQL-First** — Reverse-sync para JSON apenas para compatibilidade legacy. |
| **Funcionários** | `employees`, `employeeCategories` | `funcionarios`, `categorias_funcionarios` | SQL Estruturado (`/api/funcionarios`) | SQL Estruturado (`POST`/`PUT`/`DELETE` `/api/funcionarios`) | Não aplicável | 🟢 **100% SQL-First** — Totalmente independente do JSON. |
| **Boletim (Notas)** | `grades`, `periods` | `notas_boletim`, `periodos` | SQL Estruturado (`/api/notas`) | SQL Estruturado (`/api/notas`) | SQL Estruturado (Arithmetic Mean direto do SQL) | 🟢 **100% SQL-First** |
| **Avaliações (Provas)** | `exams` | `provas`, `questoes_provas` | SQL Estruturado (`GET /api/provas` → estado `dbExams`) | SQL Estruturado (`POST`/`PUT`/`DELETE` `/api/provas` com sync de questões) | SQL Estruturado (Tabelas `provas` e `questoes_provas`) | 🟢 **100% SQL-First** — Zero chamadas `dbService.saveData` no frontend. Questões sincronizadas inline. Reverse-sync automático no backend. |
| **Frequências (Chamadas)** | `attendance` | `frequencias` | SQL Estruturado (`GET /api/frequencias` → estado `dbAttendance`) | SQL Estruturado (`POST`/`PUT`/`DELETE` `/api/frequencias`) | SQL Estruturado (Query direta no Postgres) | 🟢 **100% SQL-First** — Zero chamadas `dbService.saveData` no frontend. Reverse-sync automático no backend. |
| **Aulas e Diários** | `lessons` | `aulas` | SQL Estruturado (`GET /api/aulas` → estado `dbLessons`) | SQL Estruturado (`POST`/`DELETE` `/api/aulas/lote`) | SQL Estruturado (Query direta no Postgres) | 🟢 **100% SQL-First** — Zero chamadas `dbService.saveData` no frontend. Reverse-sync automático no backend. |
| **Contratos** | `contracts`, `contractTemplates` | `contratos`, `modelos_contrato` | SQL Estruturado (`GET /api/contratos` e `GET /api/modelos-contrato`) | SQL Estruturado (`POST`/`PUT`/`DELETE`) | SQL Estruturado (Lê de `contratos`) | 🟢 **100% SQL-First** — Zero chamadas `dbService.saveData` no frontend. Reverse-sync no backend. |
| **Configurações Globais** | `profile`, `evolutionConfig`, `messageTemplates` | `configuracoes` | Pendente (Lê contexto JSON) | Pendente (Escreve via `dbService.saveData` no JSON) | Pendente (Lê do JSON) | 🔴 **Pendente** — Último bloco a ser migrado. |

---

## Resumo Quantitativo

| Status | Qtd. Módulos | Módulos |
|:---|:---:|:---|
| 🟢 100% SQL-First | **8** | Alunos, Financeiro, Funcionários, Boletim, Avaliações, Frequências, Aulas, Contratos |
| 🟡 Híbrido | **0** | Nenhum |
| 🔴 Pendente | **1** | Configurações Globais |

---

## Próximos Passos (Ordem Sugerida de Prioridade)

1. **Configurações Globais** — Criar tabela `configuracoes` no PostgreSQL e migrar `profile`, `evolutionConfig`, `messageTemplates` com rotas CRUD dedicadas.

---

## Regras de Arquitetura Aplicadas

- **Reverse Sync**: Todos os módulos 🟢 gravam no PostgreSQL primeiro e depois atualizam o JSON legado no backend para manter compatibilidade com módulos ainda em transição.
- **Frontend Independence**: Nenhum módulo 🟢 importa `dbService` no componente React. Todas as mutações passam por `fetch()` direto para rotas REST.
- **Biometric Safety**: A coluna `face_descriptor` usa `COALESCE(EXCLUDED.face_descriptor, alunos.face_descriptor)` para nunca sobrescrever dados biométricos.
- **Question Sync**: O módulo de Avaliações sincroniza questões inline via `syncQuestoesProva()` dentro das rotas POST/PUT, garantindo que duplicações incluam todas as questões.
