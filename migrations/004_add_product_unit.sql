-- Adiciona unidade do produto para diferenciar kg, pacote, unidade, litro etc.
alter table produtos
  add column if not exists unit text not null default 'un';
