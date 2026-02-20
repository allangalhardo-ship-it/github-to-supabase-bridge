import { CarrinhoItem, Empresa, OpcionalSelecionado, BairroEntrega } from "../types";

export interface CheckoutData {
  nome: string;
  whatsapp: string;
  tipo_entrega: "retirada" | "entrega";
  bairro_id: string;
  bairro_nome: string;
  taxa_entrega: number;
  endereco: string;
  complemento: string;
  forma_pagamento: string;
  troco_para: number | null;
  observacoes: string;
}

export type CheckoutStep = "carrinho" | "identificacao" | "entrega" | "pagamento" | "confirmacao";
