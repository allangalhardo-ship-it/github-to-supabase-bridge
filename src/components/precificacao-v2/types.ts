/**
 * Tipos para o novo sistema de Precificação baseado em Menu Engineering Matrix
 */

// Quadrantes do Menu Engineering Matrix
export type QuadranteMenu = 'estrela' | 'burro-de-carga' | 'desafio' | 'cao';

export interface ProdutoBase {
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

export interface ProdutoAnalise extends ProdutoBase {
  // Custos
  custoInsumos: number;
  
  // Métricas calculadas
  margemContribuicao: number;
  lucroUnitario: number;
  cmv: number;
  
  // Popularidade (vendas)
  quantidadeVendida: number;
  receitaTotal: number;
  
  // Preço sugerido
  precoSugerido: number;
  precoSugeridoViavel: boolean;
  
  // Classificação Menu Engineering
  quadrante: QuadranteMenu;
  
  // Status de saúde
  saudeMargem: 'critico' | 'atencao' | 'saudavel';
  saudeCmv: 'critico' | 'atencao' | 'saudavel';
  
  // Preços por canal (mapa canal -> preco)
  precosCanais?: Record<string, number>;
}

export interface ConfiguracoesPrecificacao {
  margem_desejada_padrao: number;
  cmv_alvo: number;
  imposto_medio_sobre_vendas: number;
  faturamento_mensal: number;
}

export interface TaxaApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  ativo: boolean;
}

export interface ResumoQuadrante {
  tipo: QuadranteMenu;
  quantidade: number;
  label: string;
  descricao: string;
  icone: string;
  cor: string;
  bgCor: string;
  acao: string;
}

export interface MetricasGerais {
  totalProdutos: number;
  margemMedia: number;
  cmvMedio: number;
  produtosCriticos: number;
  receitaPotencial: number;
}

// Helpers de formatação
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

// Helpers de quadrante
export const getQuadranteInfo = (quadrante: QuadranteMenu): ResumoQuadrante => {
  const infos: Record<QuadranteMenu, ResumoQuadrante> = {
    'estrela': {
      tipo: 'estrela',
      quantidade: 0,
      label: 'Estrelas',
      descricao: 'Alta margem + Alta popularidade',
      icone: '⭐',
      cor: 'text-amber-600',
      bgCor: 'bg-amber-500/10',
      acao: 'Manter e destacar',
    },
    'burro-de-carga': {
      tipo: 'burro-de-carga',
      quantidade: 0,
      label: 'Burros de Carga',
      descricao: 'Baixa margem + Alta popularidade',
      icone: '🐴',
      cor: 'text-orange-600',
      bgCor: 'bg-orange-500/10',
      acao: 'Aumentar preço',
    },
    'desafio': {
      tipo: 'desafio',
      quantidade: 0,
      label: 'Desafios',
      descricao: 'Alta margem + Baixa popularidade',
      icone: '❓',
      cor: 'text-blue-600',
      bgCor: 'bg-blue-500/10',
      acao: 'Promover mais',
    },
    'cao': {
      tipo: 'cao',
      quantidade: 0,
      label: 'Cães',
      descricao: 'Baixa margem + Baixa popularidade',
      icone: '🐕',
      cor: 'text-red-600',
      bgCor: 'bg-red-500/10',
      acao: 'Reformular ou remover',
    },
  };
  return infos[quadrante];
};
