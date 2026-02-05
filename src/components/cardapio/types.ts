export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  observacoes_ficha: string | null;
}

export interface Empresa {
  id: string;
  nome: string;
  cardapio_descricao: string | null;
  horario_funcionamento: string | null;
  whatsapp_dono: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
}

export interface CarrinhoItem {
  produto: Produto;
  quantidade: number;
  observacao: string;
}

export interface DadosCliente {
  nome: string;
  whatsapp: string;
  endereco: string;
  observacoes: string;
}
