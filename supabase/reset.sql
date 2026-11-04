-- =====================================================================
-- TOTOFANTA · azzeramento del database
--
-- ATTENZIONE: cancella TUTTE le tabelle, le viste e le funzioni dello
-- schema "public", con tutti i dati. Non si può annullare.
-- Serve a ripulire un progetto Supabase usato in passato, prima di
-- eseguire schema.sql.
-- Gli account utenti (Authentication) restano: per cancellarli togli
-- il "--" davanti all'ultima riga.
-- =====================================================================
do $$
declare r record;
begin
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
  for r in select matviewname from pg_matviews where schemaname = 'public' loop
    execute format('drop materialized view if exists public.%I cascade', r.matviewname);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.oid::regprocedure as fn
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind in ('f', 'p')
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop function if exists %s cascade', r.fn);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
            where n.nspname = 'public' and t.typtype = 'e' loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

-- delete from auth.users;
