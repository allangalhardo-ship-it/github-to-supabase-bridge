export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          page_path: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          date: string
          empresa_id: string
          id: string
          message_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          empresa_id: string
          id?: string
          message_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          empresa_id?: string
          id?: string
          message_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_movimentos: {
        Row: {
          categoria: string
          created_at: string
          data_movimento: string
          descricao: string
          empresa_id: string
          id: string
          origem: string
          referencia: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data_movimento?: string
          descricao: string
          empresa_id: string
          id?: string
          origem?: string
          referencia?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data_movimento?: string
          descricao?: string
          empresa_id?: string
          id?: string
          origem?: string
          referencia?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      canais_venda: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canais_venda_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          empresa_id: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          id: string
          nome: string
          observacoes: string | null
          preferencias: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          preferencias?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          preferencias?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_historico: {
        Row: {
          created_at: string
          dados_contexto: Json | null
          detail: string
          empresa_id: string
          headline: string
          id: string
          prioridade: number
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dados_contexto?: Json | null
          detail: string
          empresa_id: string
          headline: string
          id?: string
          prioridade?: number
          status: string
          tipo: string
        }
        Update: {
          created_at?: string
          dados_contexto?: Json | null
          detail?: string
          empresa_id?: string
          headline?: string
          id?: string
          prioridade?: number
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          cmv_alvo: number
          created_at: string
          empresa_id: string
          faturamento_mensal: number
          id: string
          imposto_medio_sobre_vendas: number
          margem_desejada_padrao: number
          taxa_app_delivery: number
          updated_at: string
        }
        Insert: {
          cmv_alvo?: number
          created_at?: string
          empresa_id: string
          faturamento_mensal?: number
          id?: string
          imposto_medio_sobre_vendas?: number
          margem_desejada_padrao?: number
          taxa_app_delivery?: number
          updated_at?: string
        }
        Update: {
          cmv_alvo?: number
          created_at?: string
          empresa_id?: string
          faturamento_mensal?: number
          id?: string
          imposto_medio_sobre_vendas?: number
          margem_desejada_padrao?: number
          taxa_app_delivery?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_fixos: {
        Row: {
          categoria: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_fixos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          banner_url: string | null
          cardapio_ativo: boolean
          cardapio_config: Json | null
          cardapio_descricao: string | null
          created_at: string
          horario_funcionamento: string | null
          id: string
          logo_url: string | null
          nome: string
          segmento: string | null
          slug: string | null
          whatsapp_dono: string | null
        }
        Insert: {
          banner_url?: string | null
          cardapio_ativo?: boolean
          cardapio_config?: Json | null
          cardapio_descricao?: string | null
          created_at?: string
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          segmento?: string | null
          slug?: string | null
          whatsapp_dono?: string | null
        }
        Update: {
          banner_url?: string | null
          cardapio_ativo?: boolean
          cardapio_config?: Json | null
          cardapio_descricao?: string | null
          created_at?: string
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          segmento?: string | null
          slug?: string | null
          whatsapp_dono?: string | null
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          created_at: string
          custo_total: number | null
          empresa_id: string
          fator_conversao: number | null
          id: string
          insumo_id: string
          observacao: string | null
          origem: string
          quantidade: number
          quantidade_original: number | null
          referencia: string | null
          tipo: string
          unidade_compra: string | null
        }
        Insert: {
          created_at?: string
          custo_total?: number | null
          empresa_id: string
          fator_conversao?: number | null
          id?: string
          insumo_id: string
          observacao?: string | null
          origem?: string
          quantidade: number
          quantidade_original?: number | null
          referencia?: string | null
          tipo: string
          unidade_compra?: string | null
        }
        Update: {
          created_at?: string
          custo_total?: number | null
          empresa_id?: string
          fator_conversao?: number | null
          id?: string
          insumo_id?: string
          observacao?: string | null
          origem?: string
          quantidade?: number
          quantidade_original?: number | null
          referencia?: string | null
          tipo?: string
          unidade_compra?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_tecnicas: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          produto_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "fichas_tecnicas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_tecnicas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_precos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          insumo_id: string
          observacao: string | null
          origem: string
          preco_anterior: number | null
          preco_novo: number
          variacao_percentual: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          insumo_id: string
          observacao?: string | null
          origem?: string
          preco_anterior?: number | null
          preco_novo: number
          variacao_percentual?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          insumo_id?: string
          observacao?: string | null
          origem?: string
          preco_anterior?: number | null
          preco_novo?: number
          variacao_percentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_precos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_precos_produtos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          observacao: string | null
          origem: string
          preco_anterior: number | null
          preco_novo: number
          produto_id: string
          variacao_percentual: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          origem?: string
          preco_anterior?: number | null
          preco_novo: number
          produto_id: string
          variacao_percentual?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          origem?: string
          preco_anterior?: number | null
          preco_novo?: number
          produto_id?: string
          variacao_percentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_precos_produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precos_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      import_templates: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          mapeamento: Json
          nome: string
          plataforma: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          mapeamento: Json
          nome: string
          plataforma: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          mapeamento?: Json
          nome?: string
          plataforma?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          created_at: string
          custo_unitario: number
          empresa_id: string
          estoque_atual: number
          estoque_minimo: number
          id: string
          is_intermediario: boolean
          nome: string
          rendimento_receita: number | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          empresa_id: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          is_intermediario?: boolean
          nome: string
          rendimento_receita?: number | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          empresa_id?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          is_intermediario?: boolean
          nome?: string
          rendimento_receita?: number | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed: boolean
          created_at: string
          current_step: number
          empresa_id: string
          first_insumo_id: string | null
          first_produto_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: number
          empresa_id: string
          first_insumo_id?: string | null
          first_produto_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: number
          empresa_id?: string
          first_insumo_id?: string | null
          first_produto_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_entrega: string | null
          empresa_id: string
          endereco_entrega: string | null
          hora_entrega: string | null
          id: string
          itens: Json
          observacoes: string | null
          origem: string
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_entrega?: string | null
          empresa_id: string
          endereco_entrega?: string | null
          hora_entrega?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_entrega?: string | null
          empresa_id?: string
          endereco_entrega?: string | null
          hora_entrega?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_canais: {
        Row: {
          canal: string
          created_at: string
          empresa_id: string
          id: string
          preco: number
          produto_id: string
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          empresa_id: string
          id?: string
          preco?: number
          produto_id: string
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          empresa_id?: string
          id?: string
          preco?: number
          produto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_canais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_canais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      producoes: {
        Row: {
          created_at: string
          data_vencimento: string | null
          dias_alerta_vencimento: number | null
          empresa_id: string
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          shelf_life_dias: number | null
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          dias_alerta_vencimento?: number | null
          empresa_id: string
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade?: number
          shelf_life_dias?: number | null
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          dias_alerta_vencimento?: number | null
          empresa_id?: string
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          shelf_life_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_mapeamento: {
        Row: {
          codigo_produto_nota: string | null
          created_at: string
          descricao_nota: string | null
          ean_gtin: string | null
          empresa_id: string
          fornecedor_cnpj: string | null
          id: string
          insumo_id: string
          unidade_conversao: number | null
        }
        Insert: {
          codigo_produto_nota?: string | null
          created_at?: string
          descricao_nota?: string | null
          ean_gtin?: string | null
          empresa_id: string
          fornecedor_cnpj?: string | null
          id?: string
          insumo_id: string
          unidade_conversao?: number | null
        }
        Update: {
          codigo_produto_nota?: string | null
          created_at?: string
          descricao_nota?: string | null
          ean_gtin?: string | null
          empresa_id?: string
          fornecedor_cnpj?: string | null
          id?: string
          insumo_id?: string
          unidade_conversao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_mapeamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_mapeamento_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          empresa_id: string
          estoque_acabado: number
          id: string
          imagem_url: string | null
          nome: string
          observacoes_ficha: string | null
          preco_venda: number
          rendimento_padrao: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          empresa_id: string
          estoque_acabado?: number
          id?: string
          imagem_url?: string | null
          nome: string
          observacoes_ficha?: string | null
          preco_venda?: number
          rendimento_padrao?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          empresa_id?: string
          estoque_acabado?: number
          id?: string
          imagem_url?: string | null
          nome?: string
          observacoes_ficha?: string | null
          preco_venda?: number
          rendimento_padrao?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_intermediarias: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          insumo_ingrediente_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          insumo_ingrediente_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          insumo_ingrediente_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_intermediarias_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_intermediarias_insumo_ingrediente_id_fkey"
            columns: ["insumo_ingrediente_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_canais: {
        Row: {
          canal_id: string
          created_at: string
          id: string
          nome: string
          percentual: number
        }
        Insert: {
          canal_id: string
          created_at?: string
          id?: string
          nome: string
          percentual?: number
        }
        Update: {
          canal_id?: string
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "taxas_canais_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_compra: {
        Row: {
          created_at: string
          empresa_id: string
          fator_conversao: number
          id: string
          insumo_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          fator_conversao?: number
          id?: string
          insumo_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          fator_conversao?: number
          id?: string
          insumo_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_compra_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          ended_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity_at: string
          os: string | null
          pages_visited: number
          session_id: string | null
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          os?: string | null
          pages_visited?: number
          session_id?: string | null
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          os?: string | null
          pages_visited?: number
          session_id?: string | null
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          asaas_plan: string | null
          asaas_subscription_end: string | null
          asaas_subscription_id: string | null
          avatar_url: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          empresa_id: string
          id: string
          is_test_user: boolean | null
          nome: string
          telefone: string | null
          trial_end_override: string | null
        }
        Insert: {
          asaas_plan?: string | null
          asaas_subscription_end?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          empresa_id: string
          id: string
          is_test_user?: boolean | null
          nome: string
          telefone?: string | null
          trial_end_override?: string | null
        }
        Update: {
          asaas_plan?: string | null
          asaas_subscription_end?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          is_test_user?: boolean | null
          nome?: string
          telefone?: string | null
          trial_end_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          canal: string | null
          cliente_id: string | null
          created_at: string
          data_venda: string
          descricao_produto: string | null
          empresa_id: string
          id: string
          origem: string
          produto_id: string | null
          quantidade: number
          tipo_venda: string
          valor_total: number
        }
        Insert: {
          canal?: string | null
          cliente_id?: string | null
          created_at?: string
          data_venda?: string
          descricao_produto?: string | null
          empresa_id: string
          id?: string
          origem?: string
          produto_id?: string | null
          quantidade?: number
          tipo_venda?: string
          valor_total?: number
        }
        Update: {
          canal?: string | null
          cliente_id?: string | null
          created_at?: string
          data_venda?: string
          descricao_produto?: string | null
          empresa_id?: string
          id?: string
          origem?: string
          produto_id?: string | null
          quantidade?: number
          tipo_venda?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_itens: {
        Row: {
          created_at: string
          custo_unitario: number | null
          ean: string | null
          id: string
          insumo_id: string | null
          mapeado: boolean | null
          produto_descricao: string | null
          quantidade: number | null
          unidade: string | null
          valor_total: number | null
          xml_id: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          ean?: string | null
          id?: string
          insumo_id?: string | null
          mapeado?: boolean | null
          produto_descricao?: string | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          xml_id: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          ean?: string | null
          id?: string
          insumo_id?: string | null
          mapeado?: boolean | null
          produto_descricao?: string | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          xml_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xml_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xml_itens_xml_id_fkey"
            columns: ["xml_id"]
            isOneToOne: false
            referencedRelation: "xml_notas"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_notas: {
        Row: {
          arquivo_xml: string | null
          created_at: string
          data_emissao: string | null
          empresa_id: string
          fornecedor: string | null
          id: string
          numero: string | null
          valor_total: number | null
        }
        Insert: {
          arquivo_xml?: string | null
          created_at?: string
          data_emissao?: string | null
          empresa_id: string
          fornecedor?: string | null
          id?: string
          numero?: string | null
          valor_total?: number | null
        }
        Update: {
          arquivo_xml?: string | null
          created_at?: string
          data_emissao?: string | null
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          numero?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xml_notas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_vendas: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_empresa_id: string
        }
        Returns: {
          canal: string
          custo_insumos: number
          data_venda: string
          id: string
          produto_id: string
          produto_nome: string
          produto_preco_venda: number
          quantidade: number
          valor_total: number
        }[]
      }
      get_insumos_estoque_baixo: {
        Args: { p_empresa_id: string }
        Returns: {
          custo_unitario: number
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          unidade_medida: string
        }[]
      }
      get_top_produtos: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_empresa_id: string
          p_limit?: number
        }
        Returns: {
          custo: number
          lucro: number
          nome: string
          produto_id: string
          quantidade: number
          receita: number
        }[]
      }
      get_user_empresa_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
