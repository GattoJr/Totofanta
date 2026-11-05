-- =====================================================================
-- TOTOFANTA · v14 · pannello admin della lega (5/11/2026)
--  · league_adjustments: bonus e penalità dell'admin della lega (sommati al totale)
--  · league_pick_status(lega, giornata): quanti pronostici ha salvato ogni partecipante (non quali), solo admin lega
--  · password della lega leggibile dagli iscritti (league_password) e cambiabile dall'admin (set_league_password)
--  · create_league salva anche la password leggibile
-- Applicata sul progetto come migrazione "v14_pannello_admin_lega" (testo completo lì).
-- =====================================================================
create table if not exists public.league_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  points numeric(7,2) not null check (points <> 0 and abs(points) <= 1000),
  reason text check (reason is null or char_length(reason) <= 80),
  created_at timestamptz not null default now()
);
-- RLS: lettura agli iscritti (is_member), inserimento/cancellazione all'admin della lega (is_admin)
-- league_pick_status / league_password / set_league_password: security definer, vedi migrazione sul progetto
