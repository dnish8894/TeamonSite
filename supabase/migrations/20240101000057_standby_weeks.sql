-- Weekly standby: a person is on standby for a whole week (Mon–Sun).
-- Multiple people can be assigned to the same week.
CREATE TABLE IF NOT EXISTS public.standby_weeks (
  id         uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  week_start date NOT NULL,                                   -- Monday of the week
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes      text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (week_start, user_id)
);

CREATE INDEX IF NOT EXISTS idx_standby_weeks_start ON public.standby_weeks USING btree (week_start);
CREATE INDEX IF NOT EXISTS idx_standby_weeks_user  ON public.standby_weeks USING btree (user_id);

COMMENT ON TABLE public.standby_weeks IS 'Weekly standby roster — week_start is the Monday; multiple users per week allowed';
