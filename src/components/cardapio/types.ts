export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  observacoes_ficha: string | null;
  grupos_opcionais?: GrupoOpcional[];
}

export interface GrupoOpcional {
  id: string;
  nome: string;
  min_selecao: number;
  max_selecao: number;
  ordem: number;
  itens: ItemOpcional[];
}

export interface ItemOpcional {
  id: string;
  nome: string;
  preco_adicional: number;
  ordem: number;
  ativo: boolean;
}

export interface OpcionalSelecionado {
  grupo_nome: string;
  item_id: string;
  item_nome: string;
  preco_adicional: number;
}

export interface Empresa {
  id: string;
  nome: string;
  cardapio_descricao: string | null;
  horario_funcionamento: string | null;
  whatsapp_dono: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  cardapio_config?: {
    categorias_ordem?: string[];
    categorias_ocultas?: string[];
  } | null;
}

export interface CarrinhoItem {
  produto: Produto;
  quantidade: number;
  observacao: string;
  opcionais: OpcionalSelecionado[];
  /** Unique key to differentiate same product with different options */
  carrinhoKey: string;
}

export interface DadosCliente {
  nome: string;
  whatsapp: string;
  endereco: string;
  observacoes: string;
}
