-- Idempotent migration: adiciona coluna `quantidade` na tabela `compras`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='compras' AND column_name='quantidade'
  ) THEN
    ALTER TABLE compras ADD COLUMN quantidade integer DEFAULT 1;
  END IF;
END
$$;

-- Garante que linhas existentes sem valor recebam 1
UPDATE compras SET quantidade = 1 WHERE quantidade IS NULL;
