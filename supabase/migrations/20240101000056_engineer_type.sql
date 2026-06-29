-- Engineers are now typed as maintenance or project (set when adding the engineer),
-- replacing the old "Project Team" user role.
ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS engineer_type text NOT NULL DEFAULT 'maintenance';

-- Carry over existing project-role staff to project engineers.
UPDATE public.engineers e
SET engineer_type = 'project'
FROM public.users u
WHERE e.user_id = u.id AND u.role = 'project';
