-- Adicionar campo de observações ao produto (para modo de preparo/anotações da ficha técnica)
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS observacoes_ficha TEXT;