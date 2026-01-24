// Templates de insumos por ramo de negócio
export interface InsumoTemplate {
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_minimo: number;
}

export interface RamoTemplate {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  insumos: InsumoTemplate[];
}

export const RAMOS_TEMPLATES: RamoTemplate[] = [
  {
    id: 'confeitaria',
    nome: 'Confeitaria / Doces',
    descricao: 'Ingredientes para bolos, doces, tortas e sobremesas',
    icone: '🍰',
    insumos: [
      // Açúcares e adoçantes
      { nome: 'Açúcar refinado', unidade_medida: 'kg', custo_unitario: 5.50, estoque_minimo: 2 },
      { nome: 'Açúcar cristal', unidade_medida: 'kg', custo_unitario: 4.80, estoque_minimo: 2 },
      { nome: 'Açúcar de confeiteiro', unidade_medida: 'kg', custo_unitario: 12.00, estoque_minimo: 1 },
      { nome: 'Açúcar mascavo', unidade_medida: 'kg', custo_unitario: 15.00, estoque_minimo: 0.5 },
      { nome: 'Açúcar demerara', unidade_medida: 'kg', custo_unitario: 10.00, estoque_minimo: 0.5 },
      
      // Farinhas
      { nome: 'Farinha de trigo', unidade_medida: 'kg', custo_unitario: 6.00, estoque_minimo: 3 },
      { nome: 'Amido de milho (Maisena)', unidade_medida: 'kg', custo_unitario: 12.00, estoque_minimo: 0.5 },
      { nome: 'Farinha de amêndoas', unidade_medida: 'kg', custo_unitario: 80.00, estoque_minimo: 0.2 },
      
      // Ovos e laticínios
      { nome: 'Ovos', unidade_medida: 'un', custo_unitario: 0.80, estoque_minimo: 30 },
      { nome: 'Leite integral', unidade_medida: 'L', custo_unitario: 5.50, estoque_minimo: 3 },
      { nome: 'Leite condensado', unidade_medida: 'un', custo_unitario: 8.00, estoque_minimo: 5 },
      { nome: 'Creme de leite', unidade_medida: 'un', custo_unitario: 6.00, estoque_minimo: 5 },
      { nome: 'Leite em pó', unidade_medida: 'kg', custo_unitario: 35.00, estoque_minimo: 0.5 },
      { nome: 'Manteiga sem sal', unidade_medida: 'kg', custo_unitario: 45.00, estoque_minimo: 1 },
      { nome: 'Manteiga com sal', unidade_medida: 'kg', custo_unitario: 42.00, estoque_minimo: 0.5 },
      { nome: 'Cream cheese', unidade_medida: 'kg', custo_unitario: 50.00, estoque_minimo: 0.5 },
      { nome: 'Chantilly (creme)', unidade_medida: 'L', custo_unitario: 25.00, estoque_minimo: 1 },
      { nome: 'Creme de leite fresco', unidade_medida: 'L', custo_unitario: 30.00, estoque_minimo: 1 },
      
      // Chocolates e cacau
      { nome: 'Chocolate ao leite', unidade_medida: 'kg', custo_unitario: 45.00, estoque_minimo: 1 },
      { nome: 'Chocolate meio amargo', unidade_medida: 'kg', custo_unitario: 50.00, estoque_minimo: 1 },
      { nome: 'Chocolate branco', unidade_medida: 'kg', custo_unitario: 48.00, estoque_minimo: 0.5 },
      { nome: 'Cacau em pó', unidade_medida: 'kg', custo_unitario: 40.00, estoque_minimo: 0.3 },
      { nome: 'Achocolatado em pó', unidade_medida: 'kg', custo_unitario: 18.00, estoque_minimo: 0.5 },
      { nome: 'Granulado de chocolate', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 0.5 },
      
      // Gorduras
      { nome: 'Óleo de soja', unidade_medida: 'L', custo_unitario: 8.00, estoque_minimo: 2 },
      { nome: 'Margarina', unidade_medida: 'kg', custo_unitario: 15.00, estoque_minimo: 1 },
      
      // Fermentos e essências
      { nome: 'Fermento em pó', unidade_medida: 'g', custo_unitario: 0.08, estoque_minimo: 200 },
      { nome: 'Fermento biológico seco', unidade_medida: 'g', custo_unitario: 0.15, estoque_minimo: 100 },
      { nome: 'Bicarbonato de sódio', unidade_medida: 'g', custo_unitario: 0.03, estoque_minimo: 200 },
      { nome: 'Essência de baunilha', unidade_medida: 'ml', custo_unitario: 0.20, estoque_minimo: 100 },
      { nome: 'Extrato de baunilha', unidade_medida: 'ml', custo_unitario: 0.50, estoque_minimo: 50 },
      
      // Frutas e polpas
      { nome: 'Morango', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 0.5 },
      { nome: 'Polpa de maracujá', unidade_medida: 'kg', custo_unitario: 20.00, estoque_minimo: 0.5 },
      { nome: 'Limão', unidade_medida: 'kg', custo_unitario: 8.00, estoque_minimo: 0.5 },
      { nome: 'Banana', unidade_medida: 'kg', custo_unitario: 6.00, estoque_minimo: 1 },
      
      // Castanhas e nozes
      { nome: 'Castanha de caju', unidade_medida: 'kg', custo_unitario: 90.00, estoque_minimo: 0.2 },
      { nome: 'Nozes', unidade_medida: 'kg', custo_unitario: 100.00, estoque_minimo: 0.2 },
      { nome: 'Amendoim torrado', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 0.3 },
      { nome: 'Coco ralado', unidade_medida: 'kg', custo_unitario: 30.00, estoque_minimo: 0.3 },
      
      // Outros
      { nome: 'Gelatina sem sabor', unidade_medida: 'g', custo_unitario: 0.30, estoque_minimo: 100 },
      { nome: 'Corante alimentício', unidade_medida: 'ml', custo_unitario: 0.50, estoque_minimo: 50 },
      { nome: 'Glucose de milho', unidade_medida: 'kg', custo_unitario: 20.00, estoque_minimo: 0.5 },
      { nome: 'Fondant', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 0.5 },
      { nome: 'Pasta americana', unidade_medida: 'kg', custo_unitario: 30.00, estoque_minimo: 0.5 },
      { nome: 'Emulsificante', unidade_medida: 'kg', custo_unitario: 35.00, estoque_minimo: 0.3 },
      { nome: 'Sal', unidade_medida: 'kg', custo_unitario: 3.00, estoque_minimo: 0.5 },
    ],
  },
  {
    id: 'hamburgueria',
    nome: 'Hamburgueria / Lanchonete',
    descricao: 'Ingredientes para hambúrgueres, sanduíches e lanches',
    icone: '🍔',
    insumos: [
      // Pães
      { nome: 'Pão de hambúrguer', unidade_medida: 'un', custo_unitario: 1.50, estoque_minimo: 50 },
      { nome: 'Pão brioche', unidade_medida: 'un', custo_unitario: 3.00, estoque_minimo: 30 },
      { nome: 'Pão australiano', unidade_medida: 'un', custo_unitario: 2.50, estoque_minimo: 30 },
      { nome: 'Pão de hot dog', unidade_medida: 'un', custo_unitario: 1.00, estoque_minimo: 30 },
      
      // Carnes
      { nome: 'Blend bovino (hambúrguer)', unidade_medida: 'kg', custo_unitario: 45.00, estoque_minimo: 3 },
      { nome: 'Carne moída', unidade_medida: 'kg', custo_unitario: 35.00, estoque_minimo: 2 },
      { nome: 'Bacon fatiado', unidade_medida: 'kg', custo_unitario: 55.00, estoque_minimo: 1 },
      { nome: 'Bacon em cubos', unidade_medida: 'kg', custo_unitario: 50.00, estoque_minimo: 1 },
      { nome: 'Peito de frango', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 2 },
      { nome: 'Linguiça artesanal', unidade_medida: 'kg', custo_unitario: 40.00, estoque_minimo: 1 },
      { nome: 'Costela desfiada', unidade_medida: 'kg', custo_unitario: 60.00, estoque_minimo: 1 },
      { nome: 'Salsicha', unidade_medida: 'kg', custo_unitario: 20.00, estoque_minimo: 1 },
      
      // Queijos
      { nome: 'Queijo cheddar', unidade_medida: 'kg', custo_unitario: 50.00, estoque_minimo: 1 },
      { nome: 'Queijo cheddar fatiado', unidade_medida: 'kg', custo_unitario: 55.00, estoque_minimo: 1 },
      { nome: 'Queijo mussarela', unidade_medida: 'kg', custo_unitario: 40.00, estoque_minimo: 1 },
      { nome: 'Queijo prato', unidade_medida: 'kg', custo_unitario: 45.00, estoque_minimo: 1 },
      { nome: 'Queijo gorgonzola', unidade_medida: 'kg', custo_unitario: 70.00, estoque_minimo: 0.5 },
      { nome: 'Cream cheese', unidade_medida: 'kg', custo_unitario: 50.00, estoque_minimo: 0.5 },
      { nome: 'Catupiry', unidade_medida: 'kg', custo_unitario: 55.00, estoque_minimo: 0.5 },
      
      // Molhos
      { nome: 'Maionese', unidade_medida: 'kg', custo_unitario: 15.00, estoque_minimo: 2 },
      { nome: 'Ketchup', unidade_medida: 'kg', custo_unitario: 12.00, estoque_minimo: 2 },
      { nome: 'Mostarda', unidade_medida: 'kg', custo_unitario: 14.00, estoque_minimo: 1 },
      { nome: 'Barbecue', unidade_medida: 'kg', custo_unitario: 18.00, estoque_minimo: 1 },
      { nome: 'Molho de pimenta', unidade_medida: 'L', custo_unitario: 25.00, estoque_minimo: 0.5 },
      { nome: 'Molho ranch', unidade_medida: 'L', custo_unitario: 30.00, estoque_minimo: 0.5 },
      { nome: 'Aioli', unidade_medida: 'kg', custo_unitario: 35.00, estoque_minimo: 0.5 },
      
      // Vegetais
      { nome: 'Alface americana', unidade_medida: 'un', custo_unitario: 5.00, estoque_minimo: 10 },
      { nome: 'Tomate', unidade_medida: 'kg', custo_unitario: 8.00, estoque_minimo: 2 },
      { nome: 'Cebola', unidade_medida: 'kg', custo_unitario: 5.00, estoque_minimo: 2 },
      { nome: 'Cebola roxa', unidade_medida: 'kg', custo_unitario: 7.00, estoque_minimo: 1 },
      { nome: 'Cebola caramelizada', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 0.5 },
      { nome: 'Picles', unidade_medida: 'kg', custo_unitario: 20.00, estoque_minimo: 0.5 },
      { nome: 'Jalapeño', unidade_medida: 'kg', custo_unitario: 30.00, estoque_minimo: 0.3 },
      { nome: 'Rúcula', unidade_medida: 'un', custo_unitario: 4.00, estoque_minimo: 5 },
      { nome: 'Cogumelo', unidade_medida: 'kg', custo_unitario: 35.00, estoque_minimo: 0.5 },
      
      // Batatas e acompanhamentos
      { nome: 'Batata palito congelada', unidade_medida: 'kg', custo_unitario: 18.00, estoque_minimo: 5 },
      { nome: 'Batata rústica congelada', unidade_medida: 'kg', custo_unitario: 20.00, estoque_minimo: 3 },
      { nome: 'Onion rings', unidade_medida: 'kg', custo_unitario: 25.00, estoque_minimo: 2 },
      { nome: 'Nuggets', unidade_medida: 'kg', custo_unitario: 22.00, estoque_minimo: 2 },
      
      // Temperos
      { nome: 'Sal', unidade_medida: 'kg', custo_unitario: 3.00, estoque_minimo: 1 },
      { nome: 'Pimenta do reino', unidade_medida: 'g', custo_unitario: 0.15, estoque_minimo: 200 },
      { nome: 'Alho em pó', unidade_medida: 'g', custo_unitario: 0.10, estoque_minimo: 200 },
      { nome: 'Cebola em pó', unidade_medida: 'g', custo_unitario: 0.10, estoque_minimo: 200 },
      { nome: 'Páprica defumada', unidade_medida: 'g', custo_unitario: 0.20, estoque_minimo: 100 },
      { nome: 'Tempero para hambúrguer', unidade_medida: 'kg', custo_unitario: 40.00, estoque_minimo: 0.3 },
      
      // Outros
      { nome: 'Óleo de soja', unidade_medida: 'L', custo_unitario: 8.00, estoque_minimo: 5 },
      { nome: 'Ovo', unidade_medida: 'un', custo_unitario: 0.80, estoque_minimo: 30 },
      { nome: 'Farinha de rosca', unidade_medida: 'kg', custo_unitario: 10.00, estoque_minimo: 1 },
    ],
  },
  {
    id: 'docesarin',
    nome: 'Docesarin',
    descricao: 'Base de insumos para doces, bolos e sobremesas artesanais',
    icone: '🧁',
    insumos: [
      // Açúcares e farinhas
      { nome: 'Açucar', unidade_medida: 'g', custo_unitario: 0.0035, estoque_minimo: 1000 },
      { nome: 'Amido de milho', unidade_medida: 'g', custo_unitario: 0.01, estoque_minimo: 500 },
      { nome: 'Farinha de Trigo', unidade_medida: 'g', custo_unitario: 0.0045, estoque_minimo: 1000 },
      { nome: 'Fermento', unidade_medida: 'g', custo_unitario: 0.099, estoque_minimo: 100 },
      
      // Laticínios e cremes
      { nome: 'Chantilly Amélia', unidade_medida: 'ml', custo_unitario: 0.028, estoque_minimo: 1000 },
      { nome: 'Creme de Leite', unidade_medida: 'un', custo_unitario: 4.50, estoque_minimo: 10 },
      { nome: 'Leite', unidade_medida: 'ml', custo_unitario: 0.0055, estoque_minimo: 2000 },
      { nome: 'Leite condensado', unidade_medida: 'un', custo_unitario: 7.00, estoque_minimo: 4 },
      { nome: 'Leite em pó (Ninho)', unidade_medida: 'g', custo_unitario: 0.079, estoque_minimo: 380 },
      { nome: 'Margarina Qually s/sal', unidade_medida: 'g', custo_unitario: 0.011, estoque_minimo: 500 },
      { nome: 'Ovo', unidade_medida: 'un', custo_unitario: 0.54, estoque_minimo: 12 },
      
      // Chocolates
      { nome: 'Chocolate Branco Nobre', unidade_medida: 'g', custo_unitario: 0.09, estoque_minimo: 500 },
      { nome: 'Chocolate em Pó', unidade_medida: 'g', custo_unitario: 0.09, estoque_minimo: 500 },
      { nome: 'Chocolate Meio Amargo', unidade_medida: 'g', custo_unitario: 0.18, estoque_minimo: 1000 },
      { nome: 'Granulé Chocolate', unidade_medida: 'g', custo_unitario: 0.225, estoque_minimo: 200 },
      { nome: 'Granulé Chocolate Branco', unidade_medida: 'g', custo_unitario: 0.225, estoque_minimo: 200 },
      { nome: 'Nutella', unidade_medida: 'g', custo_unitario: 0.077, estoque_minimo: 650 },
      
      // Frutas e saborizantes
      { nome: 'Cenoura', unidade_medida: 'g', custo_unitario: 0.01, estoque_minimo: 400 },
      { nome: 'Geleia de Morango', unidade_medida: 'g', custo_unitario: 0.079, estoque_minimo: 400 },
      { nome: 'Morango', unidade_medida: 'g', custo_unitario: 0.016, estoque_minimo: 500 },
      { nome: 'Pó Saborizante - Morango', unidade_medida: 'g', custo_unitario: 0.08, estoque_minimo: 50 },
      { nome: 'Pó Sorvete - Morango', unidade_medida: 'g', custo_unitario: 0.08, estoque_minimo: 50 },
      
      // Bombons e chocolates especiais
      { nome: 'Ferrero Rocher', unidade_medida: 'un', custo_unitario: 2.40, estoque_minimo: 5 },
      { nome: 'Kinder White', unidade_medida: 'un', custo_unitario: 4.50, estoque_minimo: 3 },
      { nome: 'Ouro Branco', unidade_medida: 'un', custo_unitario: 3.67, estoque_minimo: 15 },
      
      // Óleos
      { nome: 'Óleo', unidade_medida: 'ml', custo_unitario: 0.0099, estoque_minimo: 1000 },
    ],
  },
];

// Função para normalizar nome e comparar
export function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .trim();
}

// Função para verificar se um insumo já existe
export function verificarDuplicado(
  novoNome: string,
  insumosExistentes: { nome: string }[]
): boolean {
  const novoNormalizado = normalizarNome(novoNome);
  return insumosExistentes.some(
    (i) => normalizarNome(i.nome) === novoNormalizado
  );
}
