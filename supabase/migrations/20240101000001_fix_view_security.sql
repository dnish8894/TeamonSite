ALTER VIEW public.v_open_tickets SET (security_invoker = true);
ALTER VIEW public.v_engineer_workload SET (security_invoker = true);
ALTER VIEW public.v_device_history SET (security_invoker = true);