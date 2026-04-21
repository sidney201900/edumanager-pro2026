# MEMORY.md - Contexto de Desenvolvimento

## 📅 Estado Atual (21/04/2026)

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
  - O arquivo `supabase.ts` foi substituído por uma versão que utiliza chamadas de API HTTP (`/api/upload`) em vez do SDK da Supabase, garantindo total controle sobre os arquivos no ambiente local.
- **Funcionalidades de Configuração:**
  - Gestão multi-unidade (Alternância entre Matriz e Filiais).
  - Validação de CNPJ e busca automática via CEP.
  - Monitoramento de logs de API em tempo real.
- **Histórico de Estabilidade:**
  - Realizamos um `reset --hard e2b9810` para remover tentativas falhas de otimização de build que causaram instabilidade.
  - O sistema voltou para o último estado "verde" conhecido.

### 🚀 Infraestrutura e Deploy
- **Estado Atual:** O pipeline do GitHub Actions está configurado para gerar imagens Docker para `amd64` e `arm64`.
- **Desafio:** O build de `arm64` via QEMU é extremamente lento (>15 min). Tentativas de otimização causaram quebras e foram revertidas para manter a estabilidade.

## 📋 Próximos Passos Pendentes

1. **Migração Schoodat:** Iniciar script de migração seguindo a regra de não alteração de senhas em `GEMINI.md`.
2. **Otimização de Build:** Re-explorar o cache do Docker ou considerar a remoção do suporte nativo ARM64 se não for estritamente necessário para o servidor final.
3. **Financeiro:** Implementar visualização de extrato detalhado e integração com gateway de pagamento direto via cartão.
4. **Segurança:** Auditar as políticas de RLS no Supabase para as tabelas de sincronização.
