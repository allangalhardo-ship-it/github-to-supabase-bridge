import * as XLSX from 'xlsx';

// Template definitions
export interface TemplateColumn {
  header: string;
  key: string;
  example: string;
  required?: boolean;
}

export const INSUMOS_TEMPLATE: TemplateColumn[] = [
  { header: 'Nome', key: 'nome', example: 'Farinha de Trigo', required: true },
  { header: 'Unidade', key: 'unidade_medida', example: 'kg', required: true },
  { header: 'Custo Unitário', key: 'custo_unitario', example: '5.50', required: true },
  { header: 'Estoque Atual', key: 'estoque_atual', example: '10', required: false },
  { header: 'Estoque Mínimo', key: 'estoque_minimo', example: '5', required: false },
];

export const PRODUTOS_TEMPLATE: TemplateColumn[] = [
  { header: 'Nome', key: 'nome', example: 'Bolo de Chocolate', required: true },
  { header: 'Categoria', key: 'categoria', example: 'Bolos', required: false },
  { header: 'Preço de Venda', key: 'preco_venda', example: '45.00', required: true },
];

export const FICHA_TECNICA_TEMPLATE: TemplateColumn[] = [
  { header: 'Produto', key: 'produto_nome', example: 'Bolo de Chocolate', required: true },
  { header: 'Insumo', key: 'insumo_nome', example: 'Farinha de Trigo', required: true },
  { header: 'Quantidade', key: 'quantidade', example: '0.5', required: true },
  { header: 'Unidade', key: 'unidade', example: 'kg', required: false },
];

// Generate and download template (works on web and mobile/Capacitor)
export function downloadTemplate(
  templateColumns: TemplateColumn[],
  filename: string,
  sheetName: string = 'Dados'
) {
  const headers = templateColumns.map(col => col.header);
  const exampleRow = templateColumns.map(col => col.example);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  
  // Set column widths
  ws['!cols'] = templateColumns.map(() => ({ wch: 20 }));
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Use blob approach for better compatibility with WebView/Capacitor
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// Parse uploaded file
export async function parseExcelFile<T>(
  file: File,
  templateColumns: TemplateColumn[]
): Promise<{ data: T[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          raw: false,
          defval: '',
        });
        
        const errors: string[] = [];
        const parsedData: T[] = [];
        
        jsonData.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because of header and 0-index
          const parsedRow: Record<string, unknown> = {};
          let hasError = false;
          
          templateColumns.forEach(col => {
            // Try to match by header name (case-insensitive)
            const value = Object.entries(row).find(
              ([key]) => key.toLowerCase().trim() === col.header.toLowerCase().trim()
            )?.[1];
            
            if (col.required && (!value || String(value).trim() === '')) {
              errors.push(`Linha ${rowNumber}: Campo "${col.header}" é obrigatório`);
              hasError = true;
            } else {
              parsedRow[col.key] = value !== undefined ? String(value).trim() : '';
            }
          });
          
          if (!hasError) {
            parsedData.push(parsedRow as T);
          }
        });
        
        resolve({ data: parsedData, errors });
      } catch (error) {
        reject(new Error('Erro ao ler arquivo. Verifique se é um arquivo Excel válido.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

// Normalize string for matching (remove accents, lowercase, trim)
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Find best match from a list
export function findBestMatch<T extends { nome: string }>(
  searchTerm: string,
  items: T[]
): { item: T; score: number } | null {
  const normalizedSearch = normalizeString(searchTerm);
  
  if (!normalizedSearch) return null;
  
  let bestMatch: { item: T; score: number } | null = null;
  
  for (const item of items) {
    const normalizedName = normalizeString(item.nome);
    
    // Exact match
    if (normalizedName === normalizedSearch) {
      return { item, score: 100 };
    }
    
    // Check if one contains the other
    if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
      const score = 80;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item, score };
      }
    }
    
    // Simple similarity check (common words)
    const searchWords = normalizedSearch.split(/\s+/);
    const nameWords = normalizedName.split(/\s+/);
    const commonWords = searchWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
    
    if (commonWords.length > 0) {
      const score = (commonWords.length / Math.max(searchWords.length, nameWords.length)) * 60;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item, score };
      }
    }
  }
  
  return bestMatch;
}
