ALTER TABLE public.calendar_sync_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Berlin',
  ADD COLUMN IF NOT EXISTS last_success_slot timestamp,
  ADD COLUMN IF NOT EXISTS claimed_slot timestamp,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.calendar_sync_settings ADD CONSTRAINT calendar_sync_valid_interval CHECK(sync_interval_hours IN (1,2,4,6,12,24));

CREATE OR REPLACE FUNCTION public.calendar_sync_slot(_now timestamptz,_time time,_interval integer,_timezone text)
RETURNS timestamp LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE local_now timestamp; base timestamp;
BEGIN
  IF _interval NOT IN (1,2,4,6,12,24) OR _interval IS NULL THEN RAISE EXCEPTION 'Ungültiges Intervall' USING ERRCODE='22023'; END IF;
  local_now := _now AT TIME ZONE _timezone;
  base := local_now::date + _time;
  IF base>local_now THEN base:=base-interval '1 day'; END IF;
  RETURN base + floor(extract(epoch FROM (local_now-base))/(_interval*3600)) * make_interval(hours=>_interval);
END $$;
CREATE OR REPLACE FUNCTION public.claim_calendar_sync(_setting_id uuid)
RETURNS timestamp LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE setting public.calendar_sync_settings; slot timestamp;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO setting FROM public.calendar_sync_settings WHERE id=_setting_id AND is_enabled FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  slot:=public.calendar_sync_slot(now(),setting.sync_time,setting.sync_interval_hours,setting.timezone);
  IF setting.last_success_slot>=slot OR setting.claimed_at>now()-interval '10 minutes' THEN RETURN NULL; END IF;
  UPDATE public.calendar_sync_settings SET claimed_slot=slot,claimed_at=now() WHERE id=_setting_id;
  RETURN slot;
END $$;
CREATE OR REPLACE FUNCTION public.finish_calendar_sync(_setting_id uuid,_slot timestamp,_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  UPDATE public.calendar_sync_settings SET
    last_success_slot=CASE WHEN _success THEN _slot ELSE last_success_slot END,claimed_slot=NULL,claimed_at=NULL
    WHERE id=_setting_id AND claimed_slot=_slot;
END $$;
REVOKE ALL ON FUNCTION public.claim_calendar_sync(uuid), public.finish_calendar_sync(uuid,timestamp,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_calendar_sync(uuid), public.finish_calendar_sync(uuid,timestamp,boolean) TO service_role;
