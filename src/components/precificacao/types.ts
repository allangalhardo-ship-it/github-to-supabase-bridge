export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  fichas_tecnicas?: {
    id: string;
    quantidade: number;
    insumos: {
      id: string;
      nome: string;
      custo_unitario: number;
      unidade_medida: string;
    };
  }[];
}

export interface ProdutoComMetricas extends Produto {
  custoInsumos: number;
  lucroLiquido: number;
  margemLiquida: number;
  precoBalcao: number;
  precosApps: PrecoApp[];
  diferencaPreco: number;
  statusPreco: 'abaixo' | 'acima' | 'ideal';
}

export interface PrecoApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  preco: number;
  viavel: boolean;
}

export interface Config {
  margem_desejada_padrao: number;
  cmv_alvo: number;
  faturamento_mensal: number;
  imposto_medio_sobre_vendas: number;
}

export interface CustoFixo {
  id: string;
  nome: string;
  valor_mensal: number;
}

export interface TaxaApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  ativo: boolean;
}

export interface HistoricoPreco {
  id: string;
  produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  variacao_percentual: number | null;
  origem: string;
  observacao: string | null;
  created_at: string;
  produtos?: {
    nome: string;
  };
}

export interface CustosPercentuais {
  percCustoFixo: number;
  percImposto: number;
  margemDesejadaPadrao: number;
  totalCustosFixos: number;
  faturamento: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  link: string;
  priority: 'high' | 'medium' | 'low';
}

// Utility functions - centralized in @/lib/format
import { formatCurrencyBRL, formatCurrencySmartBRL } from '@/lib/format';
export const formatCurrency = formatCurrencyBRL;
export const formatCurrencySmart = formatCurrencySmartBRL;

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};
