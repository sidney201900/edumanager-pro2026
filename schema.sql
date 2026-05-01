-- ============================================================
-- SCHEMA NORMALIZADO PARA O EDUMANAGER SELF-HOSTED
-- PostgreSQL 15
-- Baseado nas interfaces TypeScript do types.ts
-- ============================================================

-- Extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PERFIL DA ESCOLA (Configurações Gerais)
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT PRIMARY KEY DEFAULT 'main-school',
    nome TEXT NOT NULL DEFAULT 'EduManager School',
    endereco TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    estado TEXT DEFAULT '',
    cep TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    tipo TEXT DEFAULT 'matriz' CHECK (tipo IN ('matriz', 'filial')),
    logo TEXT DEFAULT '',
    -- Configurações do Evolution API (WhatsApp)
    evolution_api_url TEXT,
    evolution_instance_name TEXT,
    evolution_api_key TEXT,
    -- Templates de mensagens (JSON)
    message_templates JSONB DEFAULT '{}',
    -- Timestamp
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. USUÁRIOS DO PAINEL ADMINISTRATIVO
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    photo_url TEXT,
    password TEXT NOT NULL,
    cpf TEXT DEFAULT '',
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin padrão
INSERT INTO usuarios (id, username, display_name, password, cpf, role)
VALUES ('default-admin', 'admin', 'Administrador', 'admin', '000.000.000-00', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. CURSOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cursos (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    duracao TEXT DEFAULT '',
    duracao_meses INTEGER DEFAULT 0,
    taxa_matricula NUMERIC(10,2) DEFAULT 0,
    mensalidade NUMERIC(10,2) DEFAULT 0,
    descricao TEXT DEFAULT '',
    multa_percentual NUMERIC(5,2) DEFAULT 0,
    juros_percentual NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. TURMAS
-- ============================================================
CREATE TABLE IF NOT EXISTS turmas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    curso_id TEXT REFERENCES cursos(id) ON DELETE SET NULL,
    professor TEXT DEFAULT '',
    horario TEXT DEFAULT '',
    dia_semana TEXT,
    max_alunos INTEGER DEFAULT 30,
    data_inicio DATE,
    data_fim DATE,
    horario_inicio_padrao TEXT,
    horario_fim_padrao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ALUNOS
-- ============================================================
CREATE TABLE IF NOT EXISTS alunos (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    email TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    data_nascimento DATE,
    cpf TEXT DEFAULT '',
    rg TEXT,
    rg_data_emissao DATE,
    nome_responsavel TEXT,
    telefone_responsavel TEXT,
    cpf_responsavel TEXT,
    data_nascimento_responsavel DATE,
    turma_id TEXT REFERENCES turmas(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
    motivo_cancelamento TEXT,
    data_matricula DATE DEFAULT CURRENT_DATE,
    foto_url TEXT,
    face_descriptor JSONB,
    -- Endereço
    cep TEXT DEFAULT '',
    rua TEXT DEFAULT '',
    numero TEXT DEFAULT '',
    bairro TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    estado TEXT DEFAULT '',
    -- Financeiro
    desconto NUMERIC(10,2) DEFAULT 0,
    tem_responsavel BOOLEAN DEFAULT FALSE,
    modelo_contrato_id TEXT,
    -- Portal do Aluno
    numero_matricula TEXT UNIQUE,
    senha_portal TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. AULAS / CRONOGRAMA
-- ============================================================
CREATE TABLE IF NOT EXISTS aulas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    horario_inicio TEXT,
    horario_fim TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed', 'rescheduled')),
    tipo TEXT DEFAULT 'regular' CHECK (tipo IN ('regular', 'reposicao', 'extra')),
    motivo_cancelamento TEXT,
    aula_original_id TEXT REFERENCES aulas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. FREQUÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS frequencias (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    aula_id TEXT REFERENCES aulas(id) ON DELETE SET NULL,
    data TIMESTAMPTZ NOT NULL,
    foto TEXT,
    verificado BOOLEAN DEFAULT FALSE,
    tipo TEXT DEFAULT 'presence' CHECK (tipo IN ('presence', 'absence')),
    justificativa TEXT,
    justificativa_aceita BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. DISCIPLINAS
-- ============================================================
CREATE TABLE IF NOT EXISTS disciplinas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    turma_id TEXT REFERENCES turmas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. PERÍODOS
-- ============================================================
CREATE TABLE IF NOT EXISTS periodos (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. NOTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS notas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    disciplina_id TEXT NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    valor NUMERIC(5,2) DEFAULT 0,
    periodo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(aluno_id, disciplina_id, periodo)
);

-- ============================================================
-- 11. PAGAMENTOS / FINANCEIRO
-- ============================================================
CREATE TABLE IF NOT EXISTS pagamentos (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    contrato_id TEXT,
    valor NUMERIC(10,2) NOT NULL,
    desconto NUMERIC(10,2) DEFAULT 0,
    tipo_desconto TEXT CHECK (tipo_desconto IN ('fixed', 'percentage')),
    multa NUMERIC(10,2) DEFAULT 0,
    juros NUMERIC(10,2) DEFAULT 0,
    vencimento DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'received', 'confirmed')),
    data_pagamento DATE,
    tipo TEXT DEFAULT 'monthly' CHECK (tipo IN ('monthly', 'registration', 'other')),
    numero_parcela INTEGER,
    total_parcelas INTEGER,
    descricao TEXT,
    asaas_payment_id TEXT,
    asaas_payment_url TEXT,
    installment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. CONTRATOS
-- ============================================================
CREATE TABLE IF NOT EXISTS contratos (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. MODELOS DE CONTRATO
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_contrato (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modelo padrão
INSERT INTO modelos_contrato (id, nome, conteudo)
VALUES ('default-template', 'Contrato Padrão', 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS

Pelo presente instrumento particular, de um lado {{escola}} (CNPJ: {{cnpj_escola}}), e de outro lado o(a) aluno(a) {{aluno}}, celebram o presente contrato:

1. DO OBJETO: Prestação de serviços educacionais no curso de {{curso}}.
2. DA DURAÇÃO: O curso terá a duração estimada de {{duracao}}.
3. DO INVESTIMENTO: O CONTRATANTE pagará o valor mensal de R$ {{mensalidade}}.
4. DAS OBRIGAÇÕES: A CONTRATADA disponibilizará material e instrutores qualificados.

Data: {{data}}

___________________________________________
Assinatura do Aluno / Responsável')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    anexo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. CERTIFICADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS certificados (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    descricao TEXT,
    imagem_frente TEXT NOT NULL,
    imagem_verso TEXT,
    data_emissao DATE NOT NULL,
    overlays_frente JSONB DEFAULT '[]',
    overlays_verso JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. MODELOS DE CERTIFICADO
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_certificado (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    imagem_frente TEXT NOT NULL,
    imagem_verso TEXT,
    overlays_frente JSONB DEFAULT '[]',
    overlays_verso JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. APOSTILAS
-- ============================================================
CREATE TABLE IF NOT EXISTS apostilas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    preco NUMERIC(10,2) DEFAULT 0,
    descricao TEXT,
    multa_percentual NUMERIC(5,2) DEFAULT 0,
    juros_percentual NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. ENTREGAS DE APOSTILAS
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas_apostilas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    apostila_id TEXT NOT NULL REFERENCES apostilas(id) ON DELETE CASCADE,
    status_entrega TEXT DEFAULT 'pending' CHECK (status_entrega IN ('pending', 'delivered')),
    status_pagamento TEXT DEFAULT 'pending' CHECK (status_pagamento IN ('pending', 'paid')),
    data_entrega DATE,
    data_pagamento DATE,
    asaas_payment_id TEXT,
    asaas_payment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. CATEGORIAS DE FUNCIONÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias_funcionarios (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. FUNCIONÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    nome TEXT NOT NULL,
    cpf TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    data_admissao DATE,
    categoria_id TEXT REFERENCES categorias_funcionarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. PROVAS / AVALIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS provas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id TEXT REFERENCES disciplinas(id) ON DELETE SET NULL,
    periodo_id TEXT,
    titulo TEXT NOT NULL,
    duracao_minutos INTEGER DEFAULT 60,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 22. QUESTÕES DAS PROVAS
-- ============================================================
CREATE TABLE IF NOT EXISTS questoes_provas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    prova_id TEXT NOT NULL REFERENCES provas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    imagem_url TEXT,
    opcoes JSONB NOT NULL DEFAULT '[]',
    indice_correto INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 23. SUBMISSÕES DE PROVAS (já existe como alunos_cobrancas no Supabase)
-- ============================================================
CREATE TABLE IF NOT EXISTS provas_submissoes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    aluno_id TEXT NOT NULL,
    prova_id TEXT NOT NULL,
    total_questoes INTEGER DEFAULT 0,
    acertos INTEGER DEFAULT 0,
    erros INTEGER DEFAULT 0,
    percentual NUMERIC(5,2) DEFAULT 0,
    nota_final NUMERIC(5,2) DEFAULT 0,
    respostas JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(aluno_id, prova_id)
);

-- ============================================================
-- 24. COBRANÇAS ASAAS (tabela que já existia separada)
-- ============================================================
CREATE TABLE IF NOT EXISTS alunos_cobrancas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id TEXT NOT NULL,
    asaas_customer_id TEXT,
    asaas_payment_id TEXT,
    asaas_installment_id TEXT,
    installment TEXT,
    valor NUMERIC(10,2),
    vencimento DATE,
    status TEXT DEFAULT 'PENDENTE',
    data_pagamento DATE,
    link_boleto TEXT,
    link_carne TEXT,
    transaction_receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 25. TABELA LEGADA (school_data JSON blob - ponte de migração)
-- Mantida para compatibilidade durante a transição
-- ============================================================
CREATE TABLE IF NOT EXISTS school_data (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alunos_turma ON alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_matricula ON alunos(numero_matricula);
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno ON frequencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_turma ON frequencias(turma_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_data ON frequencias(data);
CREATE INDEX IF NOT EXISTS idx_notas_aluno ON notas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_aluno ON pagamentos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_aulas_turma ON aulas(turma_id);
CREATE INDEX IF NOT EXISTS idx_aulas_data ON aulas(data);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno ON notificacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_aluno ON alunos_cobrancas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_asaas ON alunos_cobrancas(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_installment ON alunos_cobrancas(asaas_installment_id);
