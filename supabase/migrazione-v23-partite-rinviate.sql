-- v23 (11/11/2026): regola delle partite rinviate (decisione di Valerio).
-- Si aspetta il recupero: la partita rinviata non conta per la chiusura della giornata, il suo pronostico
-- resta modificabile e la sua quota continua ad aggiornarsi fino al suo nuovo fischio d'inizio
-- (finché la nuova data non c'è, resta aperta). Le altre partite della giornata si chiudono come sempre
-- al fischio d'inizio della prima partita non rinviata.
--
-- fixtures.postponed: messo da sync-calendario quando football-data.org dà la partita POSTPONED
-- (il calcio d'inizio originale viene tolto; quello nuovo arriva quando la partita è ricalendarizzata),
-- oppure dall'amministratore del sito dal pannello. Resta vero anche dopo il recupero.

alter table public.fixtures add column if not exists postponed boolean not null default false;

-- istante in cui si chiude il pronostico di una partita ('infinity' = ancora aperto senza data)
create or replace function public.fixture_lock_at(fid int)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select case when f.postponed then coalesce(f.kickoff, 'infinity'::timestamptz)
              else coalesce((select min(g.kickoff) from public.fixtures g where g.n = f.n and not g.postponed),
                            'infinity'::timestamptz) end
    from public.fixtures f where f.id = fid;
$$;
revoke all on function public.fixture_lock_at(int) from public, anon;
grant execute on function public.fixture_lock_at(int) to authenticated;

-- pronostici altrui leggibili e quote ferme da qui
create or replace function public.fixture_locked(fid integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(now() >= public.fixture_lock_at(fid), false);
$$;

-- pronostico inseribile/modificabile
create or replace function public.fixture_open(fid integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (f.kickoff is not null or f.postponed)
            and now() < public.fixture_lock_at(f.id)
            and public.round_published(f.n)
            and exists (select 1 from public.odds o where o.fixture_id = f.id)
       from public.fixtures f where f.id = fid),
    false);
$$;

-- pubblicazione: orario e quote per tutte le partite non rinviate
create or replace function public.calendar_rounds_check()
returns trigger language plpgsql set search_path = '' as $$
declare ok int;
begin
  if new.published and not old.published then
    select count(*) into ok from public.fixtures f
     where f.n = new.n
       and (f.postponed or (f.kickoff is not null and exists (select 1 from public.odds o where o.fixture_id = f.id)));
    if ok < 10 then
      raise exception 'Per pubblicare la %ª giornata servono orari e quote di tutte le 10 partite (complete: %)', new.n, ok;
    end if;
    new.published_at := now();
  elsif not new.published then
    new.published_at := null;
  end if;
  return new;
end $$;

-- quote automatiche: la giornata "in corso" e la prossima ignorano le rinviate; il recupero di una
-- rinviata conta come prossimo fischio (chiamata 30 minuti prima)
create or replace function private.odds_tick()
returns text language plpgsql security definer set search_path = '' as $$
declare
  loc   timestamp := now() at time zone 'Europe/Rome';
  nxt   timestamptz;
  pre   boolean;
  hourly boolean;
  left_ int;
begin
  if exists (
    select 1 from (select n, min(kickoff) a from public.fixtures where not postponed group by n) r
     where r.a <= now()
       and (select max(f.kickoff) from public.fixtures f
             where f.n = r.n and not f.postponed and f.kickoff <= r.a + interval '6 days') + interval '2 hours 30 minutes' > now()
  ) then return 'giornata in corso'; end if;

  select least(
    (select min(min_k) from (select n, min(kickoff) min_k from public.fixtures where not postponed group by n) t where min_k > now()),
    (select min(f.kickoff) from public.fixtures f where f.postponed and f.hg is null and f.kickoff > now())
  ) into nxt;
  if nxt is null or nxt > now() + interval '7 days' then return 'nessuna giornata entro 7 giorni'; end if;

  pre    := now() >= nxt - interval '32 minutes' and now() < nxt - interval '27 minutes';
  hourly := extract(hour from loc) between 8 and 21 and extract(minute from loc) < 5;
  if not (pre or hourly) then return 'non è il momento'; end if;

  select (summary->>'remaining')::int into left_ from public.sync_log
   where kind = 'quote' and summary ? 'remaining' order by ran_at desc limit 1;
  if not pre and left_ is not null and left_ < 30 then return 'crediti in esaurimento: solo aggiornamento pre-partita'; end if;

  perform net.http_post(
    url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/sync-quote',
    headers := jsonb_build_object('Content-Type','application/json',
               'x-sync-secret',(select value from private.settings where key='sync_secret')),
    body := jsonb_build_object('reason', case when pre then 'pre-partita' else 'orario' end),
    timeout_milliseconds := 30000);
  return case when pre then 'chiamata pre-partita' else 'chiamata oraria' end;
end $$;
