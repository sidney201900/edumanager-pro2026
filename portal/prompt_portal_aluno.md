# PROMPT COMPLETO — Portal do Aluno (EduManager Student Portal)

> **Copie este prompt inteiro e cole em uma nova conversa para criar o projeto do zero.**

---

## Objetivo
Atue como um Desenvolvedor Sênior Full-Stack. Crie um projeto NOVO e SEPARADO chamado **"Portal do Aluno"** — uma aplicação web onde os alunos matriculados no sistema **EduManager** podem fazer login e visualizar seus dados acadêmicos e financeiros.

Este portal **NÃO faz parte do código do EduManager**. É um projeto independente que **CONSOME os mesmos dados** do EduManager, lendo diretamente do mesmo banco de dados **Supabase**.

---

## Stack Tecnológica Obrigatória
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express (server.js)
- **Banco de Dados:** Supabase (PostgreSQL) — **o mesmo banco do EduManager, apenas leitura**
- **Estilização:** TailwindCSS
- **Deploy:** Docker (Dockerfile multi-stage) para rodar no **Portainer via Docker Swarm**
- **Porta:** 3001 (para não conflitar com o EduManager que roda na 3000)

---

## Arquitetura do Banco de Dados (Supabase — SOMENTE LEITURA)

O EduManager armazena TODOS os dados da escola em uma **única tabela** chamada `school_data` com uma **única linha** (id = 1). O campo `data` é um JSON gigante com a seguinte estrutura:

```typescript
// Tabela: school_data (id: 1, coluna "data" tipo JSONB)
{
  students: Student[],       // Lista de todos os alunos
  classes: Class[],          // Lista de turmas
  courses: Course[],         // Lista de cursos
  payments: Payment[],       // Lista de todos os pagamentos/cobranças
  contracts: Contract[],     // Contratos dos alunos
  certificates: Certificate[], // Certificados emitidos
  attendance: Attendance[],  // Registros de presença
  subjects: Subject[],       // Disciplinas
  grades: Grade[],           // Notas dos alunos
  profile: SchoolProfile,    // Dados da escola (nome, logo, etc.)
  logo?: string,             // Logo da escola em base64
}
```

### Interface Student (campos relevantes para login):
```typescript
interface Student {
  id: string;                    // UUID
  name: string;                  // Nome completo
  email: string;
  phone: string;
  birthDate: string;             // YYYY-MM-DD
  cpf: string;                   // Formato: 000.000.000-00
  rg?: string;
  classId: string;               // ID da turma vinculada
  status: 'active' | 'inactive' | 'cancelled';
  registrationDate: string;
  photo?: string;                // Base64 da foto do aluno
  addressZip?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  enrollmentNumber?: string;     // ← LOGIN (formato: MAT-202600001)
  portalPassword?: string;       // ← SENHA (padrão: 6 primeiros dígitos do CPF)
  discount?: number;
}
```

### Interface Payment (cobranças do aluno):
```typescript
interface Payment {
  id: string;
  studentId: string;             // Relaciona com Student.id
  amount: number;
  discount?: number;
  dueDate: string;               // YYYY-MM-DD
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  type: 'monthly' | 'registration' | 'other';
  installmentNumber?: number;
  totalInstallments?: number;
  description?: string;
  asaasPaymentId?: string;       // ID no Asaas
  asaasPaymentUrl?: string;      // URL do boleto no Asaas
}
```

### Outras Tabelas Auxiliares no Supabase:

**Tabela `alunos_cobrancas`** (cobranças sincronizadas com Asaas):
```sql
-- Colunas principais:
id (uuid), aluno_id (uuid), asaas_customer_id (text), asaas_payment_id (text),
asaas_installment_id (text), valor (numeric), vencimento (date),
link_boleto (text), link_carne (text), status (text), created_at (timestamptz)
```

### Interface Grade (notas):
```typescript
interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  value: number;
  period: string;    // Ex: "1º Bimestre"
}
```

### Interface Attendance (frequência):
```typescript
interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;      // ISO String
  verified: boolean;
  type?: 'presence' | 'absence';
  justification?: string;
}
```

### Interface Class e Course:
```typescript
interface Class {
  id: string;
  name: string;
  courseId: string;
  teacher: string;
  schedule: string;
}

interface Course {
  id: string;
  name: string;
  duration: string;
  monthlyFee: number;
}
```

### Interface Contract:
```typescript
interface Contract {
  id: string;
  studentId: string;
  title: string;
  content: string;     // HTML do contrato
  createdAt: string;
}
```

### Interface Certificate:
```typescript
interface Certificate {
  id: string;
  studentId: string;
  description?: string;
  issueDate: string;
}
```

### Interface SchoolProfile:
```typescript
interface SchoolProfile {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  cnpj: string;
  phone: string;
  email: string;
}
```

---

## Sistema de Autenticação

### Login:
- **Usuário:** Campo `enrollmentNumber` do aluno (ex: `MAT-202600001`)
- **Senha:** Campo `portalPassword` do aluno (padrão: 6 primeiros dígitos do CPF)

### Fluxo de Login no Backend:
1. Receber `enrollmentNumber` e `password` via POST `/api/portal/login`
2. Consultar a tabela `school_data` (id=1), pegar o JSON `data`
3. Buscar no array `data.students` o aluno cujo `enrollmentNumber` = input do usuário
4. Verificar se `portalPassword` === senha digitada
5. Se válido: gerar um JWT (jsonwebtoken) com `{ studentId, enrollmentNumber, name }` e retornar
6. Se inválido: retornar 401

### Middleware de Autenticação:
- Criar middleware `authMiddleware` que valida o JWT em todas as rotas `/api/portal/*`
- O JWT secret deve vir de `process.env.JWT_SECRET`

---

## Funcionalidades do Portal (Páginas)

### 1. Tela de Login
- Design moderno, escuro, com gradientes
- Logo da escola carregada dinamicamente do Supabase (campo `data.logo`)
- Campos: Nº de Matrícula + Senha
- Botão "Entrar"
- Mensagem de erro amigável se credenciais inválidas

### 2. Dashboard (Página Inicial pós-login)
- Saudação: "Olá, {nome do aluno}!"
- Foto do aluno (se tiver)
- Cards resumo:
  - **Turma:** nome da turma e curso vinculado
  - **Financeiro:** total de parcelas pendentes / valor total em aberto
  - **Frequência:** porcentagem de presença
  - **Próximo vencimento:** data e valor

### 3. Financeiro (Meus Boletos)
- Tabela listando TODOS os pagamentos do aluno (filtrados por `studentId`)
- Colunas: Descrição, Vencimento, Valor, Status (badges coloridos), Ação
- Botão "Ver Boleto" que abre o link do Asaas (`asaasPaymentUrl` ou buscar da tabela `alunos_cobrancas.link_boleto`)
- Filtros: Todos, Pendentes, Pagos, Atrasados
- Destaque visual para boletos atrasados (vermelho)

### 4. Notas / Boletim
- Buscar no array `data.grades` todas as notas onde `studentId` = aluno logado
- Buscar os nomes das disciplinas no array `data.subjects`
- Exibir em formato de tabela/boletim organizada por período (1º Bimestre, 2º Bimestre, etc.)
- Calcular média automaticamente

### 5. Frequência / Presença
- Buscar no array `data.attendance` onde `studentId` = aluno logado
- Mostrar calendário ou lista com os dias de presença/falta
- Exibir porcentagem total de frequência
- Justificativas de falta quando houver

### 6. Contratos
- Listar contratos do aluno (array `data.contracts` filtrado por `studentId`)
- Botão para visualizar o contrato completo (renderizar HTML)
- Botão para download/impressão

### 7. Certificados
- Listar certificados emitidos para o aluno
- Botão para visualizar/download

### 8. Meus Dados
- Exibir dados pessoais do aluno (somente leitura):
  - Nome, CPF, RG, Data de Nascimento, Telefone, Email
  - Endereço completo
  - Dados do responsável (se tiver)
- Botão "Alterar Senha" que permite trocar a `portalPassword`
  - Para salvar a nova senha: fazer PUT no server.js que atualiza o campo `portalPassword` do aluno no JSON `data.students` dentro da `school_data`

---

## Rotas do Backend (server.js)

```
POST   /api/portal/login             → Autenticação (retorna JWT)
GET    /api/portal/me                → Dados do aluno logado (protegido)
GET    /api/portal/financeiro        → Pagamentos do aluno (protegido)
GET    /api/portal/notas             → Notas/boletim do aluno (protegido)
GET    /api/portal/frequencia        → Registros de presença (protegido)
GET    /api/portal/contratos         → Contratos do aluno (protegido)
GET    /api/portal/certificados      → Certificados do aluno (protegido)
GET    /api/portal/boletos           → Boletos do Asaas (tabela alunos_cobrancas) (protegido)
PUT    /api/portal/alterar-senha     → Alterar senha do portal (protegido)
GET    /api/portal/escola            → Dados da escola + logo (público, para o login)
```

---

## Variáveis de Ambiente (Portainer)

```env
PORT=3001
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_KEY=eyJhb...
JWT_SECRET=uma-chave-secreta-forte-aqui
```

---

## Dockerfile (Multi-stage, igual ao EduManager)

```dockerfile
# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "server.js"]
```

---

## Regras e Restrições CRÍTICAS

1. **SOMENTE LEITURA** no Supabase — o portal NÃO deve criar, editar ou excluir alunos, pagamentos, notas, etc. A ÚNICA exceção é a rota `PUT /api/portal/alterar-senha` que atualiza o campo `portalPassword` dentro do JSON.

2. **Nunca expor dados de outros alunos** — todas as queries devem filtrar por `studentId` do JWT.

3. **Design Premium** — Use dark mode por padrão, gradientes modernos, animações suaves, tipografia Google Fonts (Inter ou Outfit). O visual deve ser profissional e bonito.

4. **Responsivo** — Deve funcionar perfeitamente em celulares (a maioria dos alunos acessará pelo celular).

5. **O projeto deve ser 100% funcional** — sem mocks, sem placeholder. Lê dados reais do Supabase.

6. **Separação total do EduManager** — Este é um projeto em pasta separada, repositório separado, container Docker separado. Eles compartilham apenas o banco Supabase.

---

## Estrutura de Pastas Esperada

```
portal-aluno/
├── server.js              # Backend Express
├── Dockerfile
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts           # Interfaces compartilhadas
│   ├── context/
│   │   └── AuthContext.tsx # Context de autenticação (JWT)
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Financeiro.tsx
│   │   ├── Notas.tsx
│   │   ├── Frequencia.tsx
│   │   ├── Contratos.tsx
│   │   ├── Certificados.tsx
│   │   └── MeusDados.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ProtectedRoute.tsx
│   └── styles/
│       └── index.css
```

---

**Gere o projeto completo com TODOS os arquivos acima, funcional e pronto para deploy no Docker/Portainer.**
