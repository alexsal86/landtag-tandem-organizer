# Wissen: gemessene Abfragepläne

Isoliertes PostgreSQL (PGlite), 2003 beantwortete Fragen, authentifizierte Rolle mit RLS. Gemessen werden die inneren Browse-/FTS-Pfade; RPC-Hülle, Gesamtzählung und Netzwerk sind nicht enthalten. Produktionspläne hängen von Datenverteilung und Statistik ab.

## Browsen

```text
Limit  (cost=0.28..34.03 rows=21 width=24) (actual time=0.474..0.770 rows=21.00 loops=1)
  Buffers: shared hit=26
  ->  Index Scan using knowledge_questions_answered_updated on knowledge_questions  (cost=0.28..1072.32 rows=667 width=24) (actual time=0.444..0.712 rows=21.00 loops=1)
        Index Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
        Filter: ((archived_at IS NULL) AND knowledge_qa_can_access(tenant_id, NULL::text))
        Index Searches: 1
        Buffers: shared hit=26
Planning:
  Buffers: shared hit=88
Planning Time: 1.080 ms
Execution Time: 3.221 ms
```

## Suche

```text
Limit  (cost=732.88..732.88 rows=1 width=24) (actual time=22.048..22.053 rows=2.00 loops=1)
  Buffers: shared hit=2204
  ->  Sort  (cost=732.88..732.88 rows=1 width=24) (actual time=22.046..22.049 rows=2.00 loops=1)
        Sort Key: (((CASE WHEN (title_search_vector @@ '''urlaub'''::tsquery) THEN 1 ELSE 0 END)::double precision + ts_rank_cd(search_vector, '''urlaub'''::tsquery, 32))) DESC, id
        Sort Method: quicksort  Memory: 17kB
        Buffers: shared hit=2204
        ->  Seq Scan on knowledge_questions  (cost=0.00..732.87 rows=1 width=24) (actual time=0.141..22.033 rows=2.00 loops=1)
              Filter: ((archived_at IS NULL) AND (answered_at IS NOT NULL) AND (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid) AND knowledge_qa_can_access(tenant_id, NULL::text) AND (search_vector @@ '''urlaub'''::tsquery))
              Rows Removed by Filter: 2005
              Buffers: shared hit=2204
Planning:
  Buffers: shared hit=10
Planning Time: 0.346 ms
Execution Time: 22.081 ms
```
