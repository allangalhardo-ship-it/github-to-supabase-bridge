# Guia de Migração para Supabase Pro

## 📋 Resumo dos Dados

| Tabela | Registros |
|--------|-----------|
| empresas | 11 |
| usuarios | 7 |
| insumos | 292 |
| produtos | 71 |
| fichas_tecnicas | 237 |
| vendas | 94 |
| producoes | 4 |
| estoque_movimentos | 588 |
| custos_fixos | 21 |
| clientes | 1 |
| canais_venda | 19 |
| precos_canais | 70 |
| configuracoes | 10 |
| historico_precos | 73 |
| historico_precos_produtos | 39 |
| receitas_intermediarias | 55 |
| caixa_movimentos | 3 |
| xml_notas | 4 |
| xml_itens | 10 |
| user_roles | 5 |
| onboarding_progress | 6 |
| ai_usage | 1 |
| **TOTAL** | **~1.600 registros** |

---

## 🚀 Passo a Passo da Migração

### 1. Preparação no Supabase Pro

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto Pro
3. Vá em **SQL Editor**

### 2. Executar Scripts SQL (em ordem!)

Execute os scripts na seguinte ordem:

```
1. 01-schema.sql      → Cria tabelas e estrutura
2. 02-functions.sql   → Cria funções do banco
3. 03-triggers.sql    → Cria triggers automáticos
4. 04-policies.sql    → Cria políticas RLS
5. 05-storage.sql     → Configura storage buckets
```

⚠️ **IMPORTANTE**: Execute um arquivo por vez e aguarde a conclusão antes do próximo.

### 3. Importar os Dados

Após criar a estrutura, você precisa importar os dados usando o arquivo `backup-data.json`.

**Opção A - Via SQL Editor:**
Use os comandos INSERT gerados no arquivo `06-data-import.sql`

**Opção B - Via Edge Function:**
Crie uma edge function para importar o JSON

**Opção C - Via Supabase CLI:**
```bash
# Conectar ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Importar dados (você precisará criar um script de importação)
```

### 4. Configurar Autenticação

1. Vá em **Authentication → Providers**
2. Configure Email/Password
3. Configure URLs de Redirect:
   - Site URL: `https://seu-dominio.com`
   - Redirect URLs: `https://seu-dominio.com/*`

### 5. Configurar Variáveis de Ambiente

No seu novo projeto Lovable (sem Cloud):

```env
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_REF
```

### 6. Migrar Usuários

⚠️ **Os usuários do auth.users precisam ser recriados!**

Os usuários terão que fazer novo cadastro OU você pode usar a [Management API](https://supabase.com/docs/reference/api/introduction) para criar usuários programaticamente.

Para cada usuário, você precisará:
1. Criar no auth.users com o mesmo email
2. O ID do auth.users será diferente
3. Atualizar a tabela `usuarios` com os novos IDs

---

## 📁 Arquivos de Migração

```
docs/migracao-supabase/
├── 01-schema.sql          # Estrutura das tabelas
├── 02-functions.sql       # Funções do banco
├── 03-triggers.sql        # Triggers automáticos
├── 04-policies.sql        # Políticas RLS
├── 05-storage.sql         # Buckets de storage
├── backup-data.json       # Dados exportados
└── README.md              # Este guia
```

---

## ⚠️ Considerações Importantes

### Sobre os Usuários
- Os usuários do `auth.users` do Supabase NÃO podem ser exportados por segurança
- Você tem duas opções:
  1. Pedir para os usuários fazerem novo cadastro
  2. Usar a API de Admin para criar os usuários programaticamente

### Sobre Edge Functions
- As edge functions do projeto precisam ser re-deployadas no novo Supabase
- Copie a pasta `supabase/functions/` para seu novo projeto
- Configure os secrets necessários:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `ASAAS_API_KEY`
  - `LOVABLE_API_KEY`
  - `PERPLEXITY_API_KEY`

### Sobre Dados
- O backup contém dados de TODAS as empresas
- Se quiser migrar apenas uma empresa específica, filtre pelo `empresa_id`

---

## 🔧 Suporte

Se tiver dúvidas durante a migração, você pode:
1. Consultar a [documentação do Supabase](https://supabase.com/docs)
2. Perguntar no chat do Lovable
3. Abrir issue no projeto

---

## ✅ Checklist Final

- [ ] Scripts SQL executados com sucesso
- [ ] Storage buckets criados
- [ ] Dados importados
- [ ] Usuários recriados
- [ ] Edge functions deployadas
- [ ] Secrets configurados
- [ ] Variáveis de ambiente atualizadas
- [ ] Teste de login funcionando
- [ ] Teste de CRUD funcionando
