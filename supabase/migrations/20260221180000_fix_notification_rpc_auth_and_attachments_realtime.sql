-- Fix: Enforce caller authorization inside create_notification RPC
-- and add project_conversation_attachments to realtime publication.

create or replace function public.create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_team_id uuid,
  p_project_id uuid,
  p_message_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_user_id is null then
    return;
  end if;

  if p_recipient_user_id = v_actor then
    return;
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = v_actor
  ) then
    raise exception 'Caller is not a member of the referenced team';
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    team_id,
    project_id,
    message_id,
    type,
    payload
  ) values (
    p_recipient_user_id,
    v_actor,
    p_team_id,
    p_project_id,
    p_message_id,
    p_type,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

-- Add project_conversation_attachments to realtime publication
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_conversation_attachments'
  ) then
    alter publication supabase_realtime add table public.project_conversation_attachments;
  end if;
end $$;
