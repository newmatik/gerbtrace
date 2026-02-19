-- Add preview_image_path to store the Supabase Storage path of the PCB thumbnail
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_image_path text;
