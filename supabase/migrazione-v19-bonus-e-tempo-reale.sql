-- Totofanta — migrazione v19 (6/11/2026)
-- Falla 6: la regola di inserimento dei bonus confrontava la lega dell'iscritto con sé stessa
--          (sempre vero). Ora l'iscritto deve appartenere alla lega del bonus; punti tra -1000 e 1000, mai 0.
-- Falla 8: i pronostici escono dal tempo reale. Le cancellazioni venivano inviate a tutti i collegati
--          (solo giocatore + partita); prima del fischio i pronostici altrui non sono leggibili e dopo non cambiano,
--          quindi al sito non servivano.
drop policy if exists league_adjustments_insert on public.league_adjustments;
create policy league_adjustments_insert on public.league_adjustments for insert to authenticated
  with check (public.is_admin(league_id) and exists (
    select 1 from public.members m where m.id = league_adjustments.member_id and m.league_id = league_adjustments.league_id));
drop policy if exists league_adjustments_select on public.league_adjustments;
create policy league_adjustments_select on public.league_adjustments for select to authenticated using (public.is_member(league_id));
drop policy if exists league_adjustments_delete on public.league_adjustments;
create policy league_adjustments_delete on public.league_adjustments for delete to authenticated using (public.is_admin(league_id));
revoke update on public.league_adjustments from authenticated;
alter table public.league_adjustments drop constraint if exists league_adjustments_points_range;
alter table public.league_adjustments add constraint league_adjustments_points_range check (points <> 0 and points between -1000 and 1000);
alter publication supabase_realtime drop table public.picks;
