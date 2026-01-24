// Sistema de Changelog - Histórico de versões do app
// Adicione novas versões no TOPO do array (mais recente primeiro)

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: {
    type: 'feature' | 'improvement' | 'fix' | 'security';
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-01-24',
    title: 'Sistema de Atualizações Inteligente',
    changes: [
      { type: 'feature', description: 'Novo sistema de notificação de atualizações - você controla quando atualizar' },
      { type: 'feature', description: 'Indicador de atualização na sidebar e header' },
      { type: 'feature', description: 'Histórico de versões (changelog) para ver o que mudou' },
      { type: 'improvement', description: 'App não recarrega mais sozinho durante o uso' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-01-24',
    title: 'Ícones Inteligentes para Insumos',
    changes: [
      { type: 'feature', description: 'Ícones automáticos baseados no nome do insumo (farinha, leite, carne, etc.)' },
      { type: 'improvement', description: 'Ícones consistentes em toda a aplicação: listas, selects, fichas técnicas' },
      { type: 'improvement', description: 'Visual mais intuitivo para identificar tipos de ingredientes' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-20',
    title: 'Lançamento Inicial',
    changes: [
      { type: 'feature', description: 'Dashboard com métricas do negócio' },
      { type: 'feature', description: 'Gestão de insumos e produtos' },
      { type: 'feature', description: 'Fichas técnicas e precificação' },
      { type: 'feature', description: 'Controle de estoque e produção' },
      { type: 'feature', description: 'Relatórios e análises' },
      { type: 'feature', description: 'Assistente IA para dúvidas' },
    ],
  },
];

// Retorna a versão mais recente
export const getCurrentVersion = () => changelog[0]?.version ?? '1.0.0';

// Retorna o changelog formatado para exibição
export const getLatestChanges = () => changelog[0];

// Tipo para exibição
export const changeTypeLabels: Record<ChangelogEntry['changes'][0]['type'], { label: string; color: string }> = {
  feature: { label: 'Novo', color: 'bg-emerald-500' },
  improvement: { label: 'Melhoria', color: 'bg-blue-500' },
  fix: { label: 'Correção', color: 'bg-amber-500' },
  security: { label: 'Segurança', color: 'bg-red-500' },
};
