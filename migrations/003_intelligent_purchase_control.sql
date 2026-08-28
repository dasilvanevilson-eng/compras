-- Estrutura principal para controle inteligente de compras domesticas.
create table if not exists supermercados (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists produtos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Geral',
  unit text not null default 'un',
  last_price numeric(10, 2) not null default 0,
  last_store text,
  last_purchase_date date,
  created_at timestamptz not null default now()
);

create table if not exists lista_compras (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references produtos(id) on delete cascade,
  quantity numeric(10, 2) not null default 1,
  status text not null default 'pending' check (status in ('pending', 'purchased')),
  created_at timestamptz not null default now()
);

create table if not exists cotacoes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  shopping_item_id uuid not null references lista_compras(id) on delete cascade,
  establishment text not null,
  price numeric(10, 2) not null check (price > 0),
  shipping numeric(10, 2) not null default 0 check (shipping >= 0),
  source text not null default 'physical' check (source in ('physical', 'online')),
  quoted_at date not null default current_date,
  note text
);

create table if not exists campanhas_semanais (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  supermarket_id uuid not null references supermercados(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  category text not null default 'Geral',
  description text,
  active boolean not null default true
);

create table if not exists compras_realizadas (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references produtos(id) on delete cascade,
  shopping_item_id uuid references lista_compras(id) on delete set null,
  quantity numeric(10, 2) not null default 1,
  paid_price numeric(10, 2) not null check (paid_price >= 0),
  establishment text not null,
  purchased_at date not null default current_date
);

create index if not exists supermercados_user_idx on supermercados(user_id);
create index if not exists produtos_user_idx on produtos(user_id);
create index if not exists lista_compras_user_idx on lista_compras(user_id);
create index if not exists cotacoes_item_idx on cotacoes(shopping_item_id);
create index if not exists campanhas_user_idx on campanhas_semanais(user_id);
create index if not exists compras_realizadas_user_idx on compras_realizadas(user_id);

alter table supermercados enable row level security;
alter table produtos enable row level security;
alter table lista_compras enable row level security;
alter table cotacoes enable row level security;
alter table campanhas_semanais enable row level security;
alter table compras_realizadas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'supermercados' and policyname = 'Usuarios gerenciam seus supermercados') then
    create policy "Usuarios gerenciam seus supermercados" on supermercados
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'produtos' and policyname = 'Usuarios gerenciam seus produtos') then
    create policy "Usuarios gerenciam seus produtos" on produtos
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'lista_compras' and policyname = 'Usuarios gerenciam sua lista') then
    create policy "Usuarios gerenciam sua lista" on lista_compras
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'cotacoes' and policyname = 'Usuarios gerenciam suas cotacoes') then
    create policy "Usuarios gerenciam suas cotacoes" on cotacoes
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'campanhas_semanais' and policyname = 'Usuarios gerenciam suas campanhas') then
    create policy "Usuarios gerenciam suas campanhas" on campanhas_semanais
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'compras_realizadas' and policyname = 'Usuarios gerenciam seu historico') then
    create policy "Usuarios gerenciam seu historico" on compras_realizadas
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end
$$;

create or replace function enforce_max_three_quotes()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from cotacoes
    where shopping_item_id = new.shopping_item_id
      and id <> new.id
  ) >= 3 then
    raise exception 'Cada item pode ter no maximo 3 cotacoes.';
  end if;

  return new;
end;
$$;

drop trigger if exists cotacoes_max_three on cotacoes;
create trigger cotacoes_max_three
before insert or update on cotacoes
for each row execute function enforce_max_three_quotes();
