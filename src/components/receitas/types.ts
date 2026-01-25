// Shared types for Receitas components

import { formatCurrencyBRL, formatCurrencySmartBRL } from "@/lib/format";

export interface Receita {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  is_intermediario: boolean;
  rendimento_receita: number | null;
}

export interface ReceitaIngrediente {
  id: string;
  insumo_id: string;
  insumo_ingrediente_id: string;
  quantidade: number;
  insumo_ingrediente?: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

export interface IngredienteTemp {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
}

export interface IngredienteLote {
  id: string;
  insumoId: string;
  nome: string;
  quantidadeLote: number;
  unidade: string;
  custoUnitarioInsumo: number;
  custoTotal: number;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  is_intermediario: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  rendimento_padrao: number | null;
  fichas_tecnicas?: {
    id: string;
    quantidade: number;
    insumos: {
      id: string;
      nome: string;
      unidade_medida: string;
      custo_unitario: number;
    };
  }[];
}

export const unidadesMedida = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'dz', label: 'Dúzia (dz)' },
];

export const formatCurrency = formatCurrencyBRL;

// Use when rendering unit costs that can be very small (ex.: R$/g)
export const formatCurrencySmart = formatCurrencySmartBRL;
