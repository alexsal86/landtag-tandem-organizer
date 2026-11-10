# Wissen: gemessene Abfragepläne

Isoliertes PostgreSQL (PGlite), 2.002 beantwortete Fragen, authentifizierte Rolle mit RLS. Gemessen werden die inneren Browse-/FTS-Pfade; RPC-Hülle, Gesamtzählung und Netzwerk sind nicht enthalten. Produktionspläne hängen von Datenverteilung und Statistik ab.

## Browsen

```text
Limit  (cost=0.28..33.97 rows=21 width=24) (actual time=0.252..0.598 rows=21.00 loops=1)
  Buffers: shared hit=26
  ->  Index Only Scan using knowledge_questions_answered_updated on knowledge_questions  (cost=0.28..1070.31 rows=667 width=24) (actual time=0.223..0.506 rows=21.00 loops=1)
        Index Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
        Filter: knowledge_qa_can_access(tenant_id, NULL::text)
        Heap Fetches: 21
        Index Searches: 1
        Buffers: shared hit=26
Planning:
  Buffers: shared hit=71
Planning Time: 0.692 ms
Execution Time: 0.702 ms
```

## Suche

```text
Limit  (cost=731.55..731.55 rows=1 width=24) (actual time=29.466..29.473 rows=2.00 loops=1)
  Buffers: shared hit=2203
  ->  Sort  (cost=731.55..731.55 rows=1 width=24) (actual time=29.463..29.466 rows=2.00 loops=1)
        Sort Key: (((CASE WHEN (title_search_vector @@ '''urlaub'''::tsquery) THEN 1 ELSE 0 END)::double precision + ts_rank_cd(search_vector, '''urlaub'''::tsquery))) DESC, id
        Sort Method: quicksort  Memory: 17kB
        Buffers: shared hit=2203
        ->  Seq Scan on knowledge_questions  (cost=0.00..731.54 rows=1 width=24) (actual time=0.086..29.446 rows=2.00 loops=1)
              Filter: ((answered_at IS NOT NULL) AND (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid) AND knowledge_qa_can_access(tenant_id, NULL::text) AND (search_vector @@ '''urlaub'''::tsquery))
              Rows Removed by Filter: 2000
              Buffers: shared hit=2203
Planning:
  Buffers: shared hit=10
Planning Time: 0.630 ms
Execution Time: 29.504 ms
```
