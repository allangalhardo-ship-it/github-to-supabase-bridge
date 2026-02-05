-- Adicionar constraint única para permitir upsert na tabela precos_canais
-- A combinação produto_id + canal + empresa_id deve ser única
ALTER TABLE public.precos_canais 
ADD CONSTRAINT precos_canais_produto_canal_empresa_unique 
UNIQUE (produto_id, canal, empresa_id);