-- Idempotent migration: adiciona preços e flag de carrinho na tabela compras
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS preco_1 numeric,
  ADD COLUMN IF NOT EXISTS preco_2 numeric,
  ADD COLUMN IF NOT EXISTS preco_3 numeric,
  ADD COLUMN IF NOT EXISTS in_cart boolean DEFAULT false;

UPDATE compras SET in_cart = false WHERE in_cart IS NULL;
