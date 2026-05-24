
DELETE FROM estoque_movimentos WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a';
DELETE FROM producoes WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a';
DELETE FROM vendas WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a';
DELETE FROM caixa_movimentos WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a' 
  AND (origem IN ('compra','venda','producao') OR categoria IN ('fornecedor','compra','venda','venda_avulsa'));
UPDATE insumos SET estoque_atual=0 WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a';
UPDATE produtos SET estoque_acabado=0 WHERE empresa_id='90257e2a-fabe-493e-b47e-ced30990dc3a';
