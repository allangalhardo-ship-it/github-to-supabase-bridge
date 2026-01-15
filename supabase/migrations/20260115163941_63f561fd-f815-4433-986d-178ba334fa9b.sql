-- Enable DELETE policy for estoque_movimentos (manual purchases)
CREATE POLICY "Users can delete empresa estoque_movimentos" 
ON public.estoque_movimentos 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());