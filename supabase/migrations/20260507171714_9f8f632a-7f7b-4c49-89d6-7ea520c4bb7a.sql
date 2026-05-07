
-- Egress Metrics Tabelle
CREATE TABLE IF NOT EXISTS public.egress_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  db_size_bytes BIGINT,
  storage_size_bytes BIGINT,
  table_sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_tables_by_growth JSONB NOT NULL DEFAULT '[]'::jsonb,
  realtime_channels_count INT,
  edge_function_invocations JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egress_metrics_metric_date ON public.egress_metrics(metric_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_egress_metrics_unique_day ON public.egress_metrics(metric_date);

ALTER TABLE public.egress_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view egress metrics"
  ON public.egress_metrics FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Service role manages egress metrics"
  ON public.egress_metrics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Anomalien für Alerting
CREATE TABLE IF NOT EXISTS public.egress_anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  anomaly_type TEXT NOT NULL,
  table_name TEXT,
  baseline_value NUMERIC,
  current_value NUMERIC,
  delta_pct NUMERIC,
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egress_anomalies_detected_at ON public.egress_anomalies(detected_at DESC);

ALTER TABLE public.egress_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view anomalies"
  ON public.egress_anomalies FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can ack anomalies"
  ON public.egress_anomalies FOR UPDATE
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Service role manages anomalies"
  ON public.egress_anomalies FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- RPC zum Sammeln der Tabellen-Größen
CREATE OR REPLACE FUNCTION public.get_table_size_metrics()
RETURNS TABLE(table_name TEXT, total_bytes BIGINT, row_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  RETURN QUERY
  SELECT
    c.relname::text AS table_name,
    pg_total_relation_size(c.oid)::bigint AS total_bytes,
    c.reltuples::bigint AS row_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_size BIGINT;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT pg_database_size(current_database()) INTO v_size;
  RETURN v_size;
END;
$$;
