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
      clientes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          cmv_alvo: number
          created_at: string
          empresa_id: string
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
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          insumo_id: string
          observacao: string | null
          origem: string
          quantidade: number
          referencia: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          insumo_id: string
          observacao?: string | null
          origem?: string
          quantidade: number
          referencia?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          insumo_id?: string
          observacao?: string | null
          origem?: string
          quantidade?: number
          referencia?: string | null
          tipo?: string
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
          nome: string
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
          nome: string
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
          nome?: string
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
      taxas_apps: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome_app: string
          taxa_percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome_app: string
          taxa_percentual?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome_app?: string
          taxa_percentual?: number
          updated_at?: string
        }
        Relationships: []
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
      usuarios: {
        Row: {
          created_at: string
          email: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email: string
          empresa_id: string
          id: string
          nome: string
        }
        Update: {
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          nome?: string
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
