/**
 * Encontra o canal cadastrado correspondente ao texto gravado na venda.
 * Vendas podem vir como "99Food", "ifood", "balcao", o id do canal etc.,
 * enquanto o cadastro pode estar como "99", "Ifood", "Balcão".
 */
export function normalizarCanal(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/food$/, ''); // "99food" -> "99", "ifood" -> "i"
}

export function encontrarCanal<T extends { id: string; nome: string }>(
  canais: T[] | null | undefined,
  canalVenda: string | null | undefined,
): T | undefined {
  if (!canais || !canalVenda) return undefined;
  const porId = canais.find((c) => c.id === canalVenda);
  if (porId) return porId;
  const alvo = normalizarCanal(canalVenda);
  if (!alvo) return undefined;
  return canais.find((c) => normalizarCanal(c.nome) === alvo);
}
