DO $$
DECLARE r record; idx text;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conrelid, c.conkey, cl.relname,
           string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) AS cols,
           string_agg(a.attname, '_' ORDER BY k.ord) AS colnames
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] @> c.conkey
          AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] <@ c.conkey)
    GROUP BY c.oid, c.conrelid, c.conkey, cl.relname
  LOOP
    idx := left('idx_' || r.relname || '_' || r.colnames, 55) || '_fk';
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', idx, r.tbl, r.cols);
  END LOOP;
END $$;