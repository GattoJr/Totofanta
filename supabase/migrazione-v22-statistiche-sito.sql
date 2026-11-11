-- v22 (11/11/2026): statistiche globali per il pannello dell'amministratore del sito.
--
-- 1. private.activity_days: un giorno (ora italiana) per ogni utente che ha usato il sito quel giorno.
--    "Usato" = il sito ha rinnovato l'accesso (Supabase lo fa all'apertura e poi circa ogni ora mentre
--    la pagina è aperta), ha aperto una sessione o ha salvato un pronostico. Riempita ogni 15 minuti dal
--    cron "traccia-attivita"; tenuta per sempre (poche righe: utenti × giorni).
-- 2. public.site_stats(): un unico JSON con utenti, attività, leghe, giornate, pronostici e stato del
--    sistema. Solo per gli amministratori del sito. Gli account in site_admins non contano tra gli utenti.

create table if not exists private.activity_days (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (day, user_id)
);
create index if not exists activity_days_user_idx on private.activity_days (user_id);

create or replace function private.track_activity(since timestamptz default now() - interval '2 days')
returns void language sql security definer set search_path = '' as $$
  insert into private.activity_days (day, user_id)
  select distinct (t.at at time zone 'Europe/Rome')::date, t.uid
  from (
    select r.created_at as at, r.user_id::uuid as uid from auth.refresh_tokens r where r.created_at >= since
    union all
    select s.refreshed_at at time zone 'UTC', s.user_id from auth.sessions s
      where s.refreshed_at >= (since at time zone 'UTC')
    union all
    select s.created_at, s.user_id from auth.sessions s where s.created_at >= since
    union all
    select p.updated_at, m.user_id from public.picks p join public.members m on m.id = p.member_id
      where p.updated_at >= since
  ) t
  where t.at is not null and exists (select 1 from auth.users u where u.id = t.uid)
  on conflict do nothing;
$$;
revoke all on function private.track_activity(timestamptz) from public, anon, authenticated;

-- storico già disponibile (rinnovi d'accesso dal 4/11, pronostici)
select private.track_activity('2000-01-01');

select cron.unschedule('traccia-attivita') where exists (select 1 from cron.job where jobname = 'traccia-attivita');
select cron.schedule('traccia-attivita', '*/15 * * * *', $c$select private.track_activity()$c$);

create or replace function public.site_stats()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Rome')::date;
  nxt int; nxt_k timestamptz; cur int;
  res jsonb;
begin
  if not public.is_site_admin() then raise exception 'Solo l''amministratore del sito'; end if;
  perform private.track_activity(now() - interval '1 hour');

  -- prossima giornata (prima partita non ancora iniziata) e ultima iniziata
  select n, k into nxt, nxt_k from (
    select f.n, min(coalesce(f.kickoff, f.day::timestamptz)) k from public.fixtures f group by f.n
  ) r where k > now() order by n limit 1;
  select max(n) into cur from (
    select f.n, min(coalesce(f.kickoff, f.day::timestamptz)) k from public.fixtures f group by f.n
  ) r where k <= now();

  with
  usr as (
    select u.id, u.created_at from auth.users u
    where u.deleted_at is null and not exists (select 1 from public.site_admins a where a.user_id = u.id)
  ),
  act as (select a.* from private.activity_days a join usr on usr.id = a.user_id),
  memb as (
    select m.id, m.league_id, m.user_id, m.nickname, l.start_round
    from public.members m join public.leagues l on l.id = m.league_id
  ),
  -- pronostici per iscritto e giornata
  pr as (
    select p.member_id, f.n, count(*) cnt,
      count(*) filter (where f.hg is not null) done,
      count(*) filter (where f.hg is not null and p.pick = case when f.hg > f.ag then '1' when f.hg = f.ag then 'X' else '2' end) ok
    from public.picks p join public.fixtures f on f.id = p.fixture_id
    group by p.member_id, f.n
  ),
  tot as (
    select m.id member_id,
      coalesce((select sum(rs.pts) from public.round_scores rs where rs.member_id = m.id), 0)
      + coalesce((select round(sum(a.points) * 100) from public.league_adjustments a where a.member_id = m.id), 0) cents
    from memb m
  )
  select jsonb_build_object(
    'generated_at', now(),
    'today', today,
    'next_round', nxt,
    'next_kickoff', nxt_k,
    'current_round', cur,

    'users', jsonb_build_object(
      'total', (select count(*) from usr),
      'new_today', (select count(*) from usr where (created_at at time zone 'Europe/Rome')::date = today),
      'new7', (select count(*) from usr where created_at > now() - interval '7 days'),
      'new30', (select count(*) from usr where created_at > now() - interval '30 days'),
      'active_hour', (select count(distinct s.user_id) from auth.sessions s join usr on usr.id = s.user_id
                        where s.refreshed_at > (now() at time zone 'UTC') - interval '75 minutes'),
      'active_today', (select count(*) from act where day = today),
      'active7', (select count(distinct user_id) from act where day > today - 7),
      'active30', (select count(distinct user_id) from act where day > today - 30),
      'returning7', (select count(*) from (select user_id from act where day > today - 7
                        intersect select user_id from act where day between today - 13 and today - 7) x),
      'no_league', (select count(*) from usr where not exists (select 1 from public.members m where m.user_id = usr.id)),
      'multi_league', (select count(*) from (select m.user_id from public.members m join usr on usr.id = m.user_id
                        group by m.user_id having count(*) > 1) x)
    ),

    'activity', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'active',
        (select count(*) from act where day = d),
        'new', (select count(*) from usr where (created_at at time zone 'Europe/Rome')::date = d)) order by d), '[]')
      from generate_series(0, 29) g(i), lateral (select today - 29 + g.i as d) x),

    'leagues', jsonb_build_object(
      'total', (select count(*) from public.leagues),
      'private', (select count(*) from public.leagues where type = 'private'),
      'public', (select count(*) from public.leagues where type <> 'private'),
      'new7', (select count(*) from public.leagues where created_at > now() - interval '7 days'),
      'members', (select count(*) from memb),
      'list', (select coalesce(jsonb_agg(x order by x.members desc, x.name), '[]') from (
        select l.name, l.type, l.start_round, l.created_at,
          (select count(*) from memb m where m.league_id = l.id) members,
          (select m.nickname from memb m where m.league_id = l.id and m.user_id = l.admin_id) admin,
          (select count(distinct m.user_id) from memb m join act on act.user_id = m.user_id and act.day > today - 7
             where m.league_id = l.id) active7,
          (select count(*) from memb m join pr on pr.member_id = m.id and pr.n = nxt and pr.cnt >= 10
             where m.league_id = l.id) next_complete,
          (select count(*) from memb m join pr on pr.member_id = m.id and pr.n = nxt
             where m.league_id = l.id) next_any,
          (nxt is not null and l.start_round <= nxt) next_plays,
          (select jsonb_build_object('nick', m.nickname, 'pts', round(t.cents / 100.0, 2))
             from memb m join tot t on t.member_id = m.id where m.league_id = l.id and t.cents > 0
             order by t.cents desc limit 1) leader
        from public.leagues l) x)
    ),

    'next', case when nxt is null then null else (select jsonb_build_object(
        'n', nxt, 'kickoff', nxt_k, 'published', coalesce((select c.published from public.calendar_rounds c where c.n = nxt), false),
        'eligible', count(*),
        'complete', count(*) filter (where coalesce(pr.cnt, 0) >= 10),
        'partial', count(*) filter (where coalesce(pr.cnt, 0) between 1 and 9),
        'none', count(*) filter (where coalesce(pr.cnt, 0) = 0))
      from memb m left join pr on pr.member_id = m.id and pr.n = nxt
      where m.start_round <= nxt) end,

    'rounds', (select coalesce(jsonb_agg(r order by r.n desc), '[]') from (
      select g.n,
        (select count(*) from memb m where m.start_round <= g.n) eligible,
        (select count(*) from memb m join pr on pr.member_id = m.id and pr.n = g.n where m.start_round <= g.n) players,
        (select count(*) from memb m join pr on pr.member_id = m.id and pr.n = g.n and pr.cnt >= 10 where m.start_round <= g.n) complete,
        (select count(*) from public.fixtures f where f.n = g.n and f.hg is not null) finished,
        (select sum(pr.done) from memb m join pr on pr.member_id = m.id and pr.n = g.n where m.start_round <= g.n) evaluated,
        (select sum(pr.ok) from memb m join pr on pr.member_id = m.id and pr.n = g.n where m.start_round <= g.n) correct,
        (select round(avg(rs.pts) / 100.0, 2) from public.round_scores rs where rs.n = g.n) avg_pts,
        (select jsonb_build_object('nick', m.nickname, 'league', l.name, 'pts', round(rs.pts / 100.0, 2))
           from public.round_scores rs join public.members m on m.id = rs.member_id join public.leagues l on l.id = rs.league_id
           where rs.n = g.n and rs.pts > 0 order by rs.pts desc limit 1) best
      from (select distinct f.n from public.fixtures f where cur is not null and f.n <= cur
              and f.n >= (select coalesce(min(start_round), 1) from public.leagues)) g
    ) r),

    'picks', (select jsonb_build_object(
        'total', count(*),
        'p1', count(*) filter (where p.pick = '1'),
        'px', count(*) filter (where p.pick = 'X'),
        'p2', count(*) filter (where p.pick = '2'),
        'evaluated', count(*) filter (where f.hg is not null),
        'correct', count(*) filter (where f.hg is not null and p.pick = case when f.hg > f.ag then '1' when f.hg = f.ag then 'X' else '2' end))
      from public.picks p join public.fixtures f on f.id = p.fixture_id),

    'system', jsonb_build_object(
      'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
      'db_limit_mb', 500,
      'last_calendar', (select jsonb_build_object('at', s.ran_at, 'ok', s.ok) from public.sync_log s where s.kind = 'calendario' order by s.ran_at desc limit 1),
      'last_odds', (select jsonb_build_object('at', s.ran_at, 'ok', s.ok, 'remaining', s.summary->'remaining') from public.sync_log s where s.kind = 'quote' order by s.ran_at desc limit 1),
      'sync_errors7', (select count(*) from public.sync_log s where not s.ok and s.ran_at > now() - interval '7 days'),
      'cron_errors7', (select count(*) from cron.job_run_details d where d.status = 'failed' and d.start_time > now() - interval '7 days'),
      'odds_alerts', (select count(*) from public.odds_alerts)
    )
  ) into res;
  return res;
end $$;
revoke all on function public.site_stats() from public, anon;
grant execute on function public.site_stats() to authenticated;
