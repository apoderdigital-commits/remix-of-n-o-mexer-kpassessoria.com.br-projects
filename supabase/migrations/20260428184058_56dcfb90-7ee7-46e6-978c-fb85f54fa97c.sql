-- Tabela de tokens nomeados da Meta
CREATE TABLE public.meta_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_tokens ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar tokens
CREATE POLICY "Admins can manage meta tokens"
ON public.meta_tokens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_meta_tokens_updated_at
BEFORE UPDATE ON public.meta_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona referência no cliente para o token escolhido
ALTER TABLE public.clients
ADD COLUMN meta_token_id UUID REFERENCES public.meta_tokens(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_meta_token_id ON public.clients(meta_token_id);