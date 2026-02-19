-- Enable Realtime for team members and invitations so the team settings UI
-- updates when another user adds/removes members or accepts invitations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_invitations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
  END IF;
END $$;
