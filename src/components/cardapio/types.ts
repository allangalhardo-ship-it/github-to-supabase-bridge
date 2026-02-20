export interface Empresa {
  id: string;
  nome: string;
  slug: string | null;
  cardapio_descricao: string | null;
  horario_funcionamento: string | null;
  whatsapp_dono: string | null;
  logo_url: string | null;
  banner_url: string | null;
  chave_pix: string | null;
  entrega_ativa: boolean;
  pedido_minimo: number;
  tempo_estimado_entrega: string | null;
  cardapio_config: {
    categorias_ordem?: string[];
    categorias_ocultas?: string[];
  };
}

export interface GrupoOpcional {
  id: string;
  produto_id: string;
  nome: string;
  min_selecao: number;
  max_selecao: number;
  ordem: number;
  itens: ItemOpcional[];
}

export interface ItemOpcional {
  id: string;
  grupo_id: string;
  nome: string;
  preco_adicional: number;
  ordem: number;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  observacoes_ficha: string | null;
  descricao_cardapio: string | null;
  destaque: boolean;
  grupos_opcionais?: GrupoOpcional[];
}

export interface OpcionalSelecionado {
  grupo_id: string;
  item_id: string;
  nome: string;
  preco_adicional: number;
}

export interface CarrinhoItem {
  produto: Produto;
  quantidade: number;
  observacao: string;
  opcionais: OpcionalSelecionado[];
  carrinhoKey: string;
}

export interface BairroEntrega {
  id: string;
  empresa_id: string;
  nome: string;
  taxa_entrega: number;
  ativo: boolean;
  ordem: number;
}

export interface Pedido {
  id: string;
  numero_pedido: number;
  empresa_id: string;
  status: string;
  itens: any[];
  valor_total: number;
  subtotal: number;
  taxa_entrega: number;
  tipo_entrega: string;
  bairro_entrega: string | null;
  endereco_entrega: string | null;
  forma_pagamento: string;
  troco_para: number | null;
  cliente_nome: string | null;
  cliente_whatsapp: string | null;
  observacoes: string | null;
  origem: string;
  created_at: string;
  confirmado_em: string | null;
  preparando_em: string | null;
  pronto_em: string | null;
  saiu_entrega_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
}
