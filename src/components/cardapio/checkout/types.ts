export type CheckoutStep = 'carrinho' | 'entrega' | 'pagamento' | 'confirmacao';

export type TipoEntrega = 'retirada' | 'entrega';

export type FormaPagamento = 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito';

export interface DadosEntrega {
  tipo: TipoEntrega;
  nome: string;
  whatsapp: string;
  endereco: string;
}

export interface DadosPagamento {
  forma: FormaPagamento;
  troco_para?: number;
}

export interface PedidoCriado {
  id: string;
  numero_pedido: number;
}

export const FORMAS_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
};
