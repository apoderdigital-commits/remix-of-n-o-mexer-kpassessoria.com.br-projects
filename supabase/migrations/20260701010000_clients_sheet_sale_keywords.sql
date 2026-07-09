-- Palavras-chave extras (por cliente) que contam como "Venda" na planilha (ex.: "Vendido")
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sheet_sale_keywords text;
