-- Palavras-chave extras (por cliente) que contam como "CPF Aprovado" na planilha
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sheet_cpf_keywords text;
