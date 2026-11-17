-- User-authorized consolidation of the existing member register and results.
-- Separate from the result import: reuse confirmed connections, never name-match.
-- Repeat-safe after a failed SQL-editor execution; existing source rows are preserved.
BEGIN;
ALTER TABLE public.election_history_candidacies ALTER COLUMN vote_share TYPE numeric(9,5),
 ADD COLUMN IF NOT EXISTS result_origin text,
 ADD COLUMN IF NOT EXISTS result_preliminary boolean,
 ADD COLUMN IF NOT EXISTS result_data_release text,
 ADD COLUMN IF NOT EXISTS result_notes text,
 ADD COLUMN IF NOT EXISTS result_snapshot jsonb;
CREATE TABLE IF NOT EXISTS public.election_history_connection_people (
 connection_id uuid PRIMARY KEY,
 person_id uuid NOT NULL UNIQUE REFERENCES public.election_history_people(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.election_history_assembly_issues (
 period_id uuid NOT NULL REFERENCES public.election_history_periods(id) ON DELETE CASCADE,
 record_key text NOT NULL, reason text NOT NULL, details text,
 PRIMARY KEY(period_id,record_key)
);
ALTER TABLE public.election_history_connection_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_history_assembly_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_history_connection_people,public.election_history_assembly_issues FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_history_connection_people,public.election_history_assembly_issues TO authenticated;
DO $policy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='election_history_connection_people' AND policyname='superadmin_write') THEN
  CREATE POLICY superadmin_write ON public.election_history_connection_people FOR ALL TO authenticated
   USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
 END IF;
END $policy$;
DO $policy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='election_history_assembly_issues' AND policyname='superadmin_write') THEN
  CREATE POLICY superadmin_write ON public.election_history_assembly_issues FOR ALL TO authenticated
   USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
 END IF;
END $policy$;


-- 1952 source binding uses exact IDs from the original member import. These are
-- NOT technical map IDs. No district is renamed, renumbered or geometry-linked.
CREATE TABLE IF NOT EXISTS public.election_history_1952_result_sources (
 source_mandate_id uuid NOT NULL REFERENCES public.election_history_mandates(id),
 district_id uuid NOT NULL REFERENCES public.election_history_districts(id),
 party text NOT NULL, share numeric(9,5) NOT NULL CHECK(share BETWEEN 0 AND 100),
 source_row integer NOT NULL, source_url text NOT NULL,
 PRIMARY KEY(district_id,party)
);
ALTER TABLE public.election_history_1952_result_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_history_1952_result_sources FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_history_1952_result_sources TO authenticated;
DO $policy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='election_history_1952_result_sources' AND policyname='superadmin_write') THEN
  CREATE POLICY superadmin_write ON public.election_history_1952_result_sources FOR ALL TO authenticated
   USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
 END IF;
END $policy$;
INSERT INTO public.election_history_1952_result_sources
 SELECT x.* FROM jsonb_to_recordset($original_1952$[
{"source_mandate_id":"6734954a-c214-566d-ad87-62215dda3fb0","district_id":"d489adec-840e-503c-a59c-36712676e023","party":"CDU","share":52.27455,"source_row":6,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"6734954a-c214-566d-ad87-62215dda3fb0","district_id":"d489adec-840e-503c-a59c-36712676e023","party":"SPD","share":19.69343,"source_row":6,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"6734954a-c214-566d-ad87-62215dda3fb0","district_id":"d489adec-840e-503c-a59c-36712676e023","party":"FDP","share":10.64294,"source_row":6,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9bd1697c-2633-5708-a62d-fc992cb3bd0f","district_id":"32b5eb9a-8efd-5d86-95b4-79129aff2a8a","party":"CDU","share":19.01133,"source_row":7,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9bd1697c-2633-5708-a62d-fc992cb3bd0f","district_id":"32b5eb9a-8efd-5d86-95b4-79129aff2a8a","party":"SPD","share":31.13776,"source_row":7,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9bd1697c-2633-5708-a62d-fc992cb3bd0f","district_id":"32b5eb9a-8efd-5d86-95b4-79129aff2a8a","party":"FDP","share":31.42933,"source_row":7,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"be145057-83ec-55f4-b84a-b4a5724a20b0","district_id":"e29c8479-3b26-5692-9b7e-69e6f72a3cf9","party":"CDU","share":47.35589,"source_row":8,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"be145057-83ec-55f4-b84a-b4a5724a20b0","district_id":"e29c8479-3b26-5692-9b7e-69e6f72a3cf9","party":"SPD","share":21.08636,"source_row":8,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"be145057-83ec-55f4-b84a-b4a5724a20b0","district_id":"e29c8479-3b26-5692-9b7e-69e6f72a3cf9","party":"FDP","share":18.78896,"source_row":8,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"aebe4085-77fc-5c77-823c-b2436f290019","district_id":"02ffd10a-cb23-53e1-ae1a-b5441ad5f303","party":"CDU","share":30.81119,"source_row":9,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"aebe4085-77fc-5c77-823c-b2436f290019","district_id":"02ffd10a-cb23-53e1-ae1a-b5441ad5f303","party":"SPD","share":36.34882,"source_row":9,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"aebe4085-77fc-5c77-823c-b2436f290019","district_id":"02ffd10a-cb23-53e1-ae1a-b5441ad5f303","party":"FDP","share":19.49978,"source_row":9,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8a2351cc-f767-58da-b406-250683fee7d3","district_id":"7c2745cb-1796-52e7-b253-de13a4e2f11f","party":"CDU","share":71.50457,"source_row":10,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8a2351cc-f767-58da-b406-250683fee7d3","district_id":"7c2745cb-1796-52e7-b253-de13a4e2f11f","party":"SPD","share":9.70078,"source_row":10,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8a2351cc-f767-58da-b406-250683fee7d3","district_id":"7c2745cb-1796-52e7-b253-de13a4e2f11f","party":"FDP","share":10.23278,"source_row":10,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4a861731-4358-585e-97a6-77d5c04aa4e8","district_id":"c0452049-22e7-5f7e-89ff-e214f75508ba","party":"CDU","share":39.80421,"source_row":11,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4a861731-4358-585e-97a6-77d5c04aa4e8","district_id":"c0452049-22e7-5f7e-89ff-e214f75508ba","party":"SPD","share":37.28477,"source_row":11,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4a861731-4358-585e-97a6-77d5c04aa4e8","district_id":"c0452049-22e7-5f7e-89ff-e214f75508ba","party":"FDP","share":0,"source_row":11,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"df746397-6784-5b85-8a0b-725f43f4db2a","district_id":"25f028db-e8f0-5461-b964-8658a93992f6","party":"CDU","share":54.93833,"source_row":12,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"df746397-6784-5b85-8a0b-725f43f4db2a","district_id":"25f028db-e8f0-5461-b964-8658a93992f6","party":"SPD","share":23.10073,"source_row":12,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"df746397-6784-5b85-8a0b-725f43f4db2a","district_id":"25f028db-e8f0-5461-b964-8658a93992f6","party":"FDP","share":6.20051,"source_row":12,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"437e7370-45c9-57e0-8d3f-c3783b02c7a9","district_id":"ead0f28f-8423-5854-879f-d75830cbe2f8","party":"CDU","share":57.20555,"source_row":13,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"437e7370-45c9-57e0-8d3f-c3783b02c7a9","district_id":"ead0f28f-8423-5854-879f-d75830cbe2f8","party":"SPD","share":11.39788,"source_row":13,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"437e7370-45c9-57e0-8d3f-c3783b02c7a9","district_id":"ead0f28f-8423-5854-879f-d75830cbe2f8","party":"FDP","share":8.55168,"source_row":13,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f48c0bbf-b9e7-5b3c-a122-01e39b9d872f","district_id":"e01d1142-576c-5425-a352-ce1a7dc7b980","party":"CDU","share":34.71697,"source_row":14,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f48c0bbf-b9e7-5b3c-a122-01e39b9d872f","district_id":"e01d1142-576c-5425-a352-ce1a7dc7b980","party":"SPD","share":28.97054,"source_row":14,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f48c0bbf-b9e7-5b3c-a122-01e39b9d872f","district_id":"e01d1142-576c-5425-a352-ce1a7dc7b980","party":"FDP","share":23.50062,"source_row":14,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b661d941-f4c7-5e2a-a3d8-92865e6b85ed","district_id":"b252e321-aea1-50f7-94be-dd1c654e5871","party":"CDU","share":41.25874,"source_row":15,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b661d941-f4c7-5e2a-a3d8-92865e6b85ed","district_id":"b252e321-aea1-50f7-94be-dd1c654e5871","party":"SPD","share":25.13283,"source_row":15,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b661d941-f4c7-5e2a-a3d8-92865e6b85ed","district_id":"b252e321-aea1-50f7-94be-dd1c654e5871","party":"FDP","share":17.30612,"source_row":15,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3f3d4ae2-260d-5d30-92a5-24c81857d351","district_id":"1f98c80f-9234-5015-9dc1-e1330b7800a8","party":"CDU","share":49.56485,"source_row":16,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3f3d4ae2-260d-5d30-92a5-24c81857d351","district_id":"1f98c80f-9234-5015-9dc1-e1330b7800a8","party":"SPD","share":22.8523,"source_row":16,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3f3d4ae2-260d-5d30-92a5-24c81857d351","district_id":"1f98c80f-9234-5015-9dc1-e1330b7800a8","party":"FDP","share":21.63786,"source_row":16,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c551ebfa-c35e-5846-983e-72f673c85525","district_id":"df7aa2ca-a4d8-577c-960c-18153b6ba232","party":"CDU","share":44.02137,"source_row":17,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c551ebfa-c35e-5846-983e-72f673c85525","district_id":"df7aa2ca-a4d8-577c-960c-18153b6ba232","party":"SPD","share":31.13055,"source_row":17,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c551ebfa-c35e-5846-983e-72f673c85525","district_id":"df7aa2ca-a4d8-577c-960c-18153b6ba232","party":"FDP","share":12.61192,"source_row":17,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ceec9a64-9d4b-5ef4-a635-c4485210e6c6","district_id":"1fef9aff-f733-5da2-b48f-f78da2d19b13","party":"CDU","share":23.04532,"source_row":18,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ceec9a64-9d4b-5ef4-a635-c4485210e6c6","district_id":"1fef9aff-f733-5da2-b48f-f78da2d19b13","party":"SPD","share":32.13897,"source_row":18,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ceec9a64-9d4b-5ef4-a635-c4485210e6c6","district_id":"1fef9aff-f733-5da2-b48f-f78da2d19b13","party":"FDP","share":12.92447,"source_row":18,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"214891db-bd1f-5ded-ade0-5561b3b59eb1","district_id":"2baa33f3-cb27-5c3c-bde5-12a922ece1ca","party":"CDU","share":20.60547,"source_row":19,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"214891db-bd1f-5ded-ade0-5561b3b59eb1","district_id":"2baa33f3-cb27-5c3c-bde5-12a922ece1ca","party":"SPD","share":39.22594,"source_row":19,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"214891db-bd1f-5ded-ade0-5561b3b59eb1","district_id":"2baa33f3-cb27-5c3c-bde5-12a922ece1ca","party":"FDP","share":13.91323,"source_row":19,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4928ee46-07ed-5c80-80d9-866d6e8cbdc0","district_id":"e3ca7f36-d20c-59ab-b096-d614c20e5449","party":"CDU","share":48.34322,"source_row":20,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4928ee46-07ed-5c80-80d9-866d6e8cbdc0","district_id":"e3ca7f36-d20c-59ab-b096-d614c20e5449","party":"SPD","share":25.87272,"source_row":20,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4928ee46-07ed-5c80-80d9-866d6e8cbdc0","district_id":"e3ca7f36-d20c-59ab-b096-d614c20e5449","party":"FDP","share":11.04114,"source_row":20,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c4323b47-3028-5377-a82d-c6475634ceaa","district_id":"ba3a848f-476c-5da7-91d6-48949f40adec","party":"CDU","share":39.23954,"source_row":21,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c4323b47-3028-5377-a82d-c6475634ceaa","district_id":"ba3a848f-476c-5da7-91d6-48949f40adec","party":"SPD","share":29.5692,"source_row":21,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"c4323b47-3028-5377-a82d-c6475634ceaa","district_id":"ba3a848f-476c-5da7-91d6-48949f40adec","party":"FDP","share":18.51295,"source_row":21,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1d343fc7-28d6-53f4-ae03-00e1526332f9","district_id":"34bd28f3-5f44-571a-b9f0-536d3e3417ea","party":"CDU","share":35.87556,"source_row":22,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1d343fc7-28d6-53f4-ae03-00e1526332f9","district_id":"34bd28f3-5f44-571a-b9f0-536d3e3417ea","party":"SPD","share":19.88845,"source_row":22,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1d343fc7-28d6-53f4-ae03-00e1526332f9","district_id":"34bd28f3-5f44-571a-b9f0-536d3e3417ea","party":"FDP","share":31.40156,"source_row":22,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b76b6d15-911d-5b4d-a6cd-b121f9872349","district_id":"3fc94a38-c988-59c8-8b92-1b19c63afc11","party":"CDU","share":18.5539,"source_row":23,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b76b6d15-911d-5b4d-a6cd-b121f9872349","district_id":"3fc94a38-c988-59c8-8b92-1b19c63afc11","party":"SPD","share":37.89161,"source_row":23,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b76b6d15-911d-5b4d-a6cd-b121f9872349","district_id":"3fc94a38-c988-59c8-8b92-1b19c63afc11","party":"FDP","share":24.31649,"source_row":23,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f6dd0941-5d22-5180-80ca-88b9842fd8bf","district_id":"e8e001b9-b7b6-5d73-8d07-33809786ac72","party":"CDU","share":34.51633,"source_row":24,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f6dd0941-5d22-5180-80ca-88b9842fd8bf","district_id":"e8e001b9-b7b6-5d73-8d07-33809786ac72","party":"SPD","share":23.55206,"source_row":24,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f6dd0941-5d22-5180-80ca-88b9842fd8bf","district_id":"e8e001b9-b7b6-5d73-8d07-33809786ac72","party":"FDP","share":7.96057,"source_row":24,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"fcfdf1dc-fc1a-5c59-8e98-c1e765f9f1d3","district_id":"510d750c-29cb-53a3-acb0-01cc93444b63","party":"CDU","share":64.14789,"source_row":25,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"fcfdf1dc-fc1a-5c59-8e98-c1e765f9f1d3","district_id":"510d750c-29cb-53a3-acb0-01cc93444b63","party":"SPD","share":16.76314,"source_row":25,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"fcfdf1dc-fc1a-5c59-8e98-c1e765f9f1d3","district_id":"510d750c-29cb-53a3-acb0-01cc93444b63","party":"FDP","share":9.38413,"source_row":25,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"41e7db0d-35d6-590c-b1b2-4cf200c1d239","district_id":"1459a0a7-d6f6-5bcb-ba4c-4c6a9ad82fbe","party":"CDU","share":36.76334,"source_row":26,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"41e7db0d-35d6-590c-b1b2-4cf200c1d239","district_id":"1459a0a7-d6f6-5bcb-ba4c-4c6a9ad82fbe","party":"SPD","share":29.14705,"source_row":26,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"41e7db0d-35d6-590c-b1b2-4cf200c1d239","district_id":"1459a0a7-d6f6-5bcb-ba4c-4c6a9ad82fbe","party":"FDP","share":10.9161,"source_row":26,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"5cf45012-33ad-57d5-946d-7801abecbf6a","district_id":"a4766e25-63cf-5d2a-ab2d-c724a06d56a1","party":"CDU","share":31.21302,"source_row":27,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"5cf45012-33ad-57d5-946d-7801abecbf6a","district_id":"a4766e25-63cf-5d2a-ab2d-c724a06d56a1","party":"SPD","share":31.90746,"source_row":27,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"5cf45012-33ad-57d5-946d-7801abecbf6a","district_id":"a4766e25-63cf-5d2a-ab2d-c724a06d56a1","party":"FDP","share":17.86654,"source_row":27,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f5a1f0fb-5d58-5d9f-9fdc-0dc68a488b9f","district_id":"5f01707d-feb1-5e87-a5b6-1b126eac4e53","party":"CDU","share":30.37692,"source_row":28,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f5a1f0fb-5d58-5d9f-9fdc-0dc68a488b9f","district_id":"5f01707d-feb1-5e87-a5b6-1b126eac4e53","party":"SPD","share":20.70925,"source_row":28,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f5a1f0fb-5d58-5d9f-9fdc-0dc68a488b9f","district_id":"5f01707d-feb1-5e87-a5b6-1b126eac4e53","party":"FDP","share":11.50674,"source_row":28,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"71f0cfd1-fa06-5cb1-a0e6-9c63be9e872d","district_id":"41ed323a-74ac-5faa-8fa2-3026c187699d","party":"CDU","share":32.60675,"source_row":29,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"71f0cfd1-fa06-5cb1-a0e6-9c63be9e872d","district_id":"41ed323a-74ac-5faa-8fa2-3026c187699d","party":"SPD","share":28.2507,"source_row":29,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"71f0cfd1-fa06-5cb1-a0e6-9c63be9e872d","district_id":"41ed323a-74ac-5faa-8fa2-3026c187699d","party":"FDP","share":24.10782,"source_row":29,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"52105440-18c3-5eaf-9a0e-aa270495ac90","district_id":"e705a298-4abd-5432-b135-d829a61c288b","party":"CDU","share":18.53605,"source_row":30,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"52105440-18c3-5eaf-9a0e-aa270495ac90","district_id":"e705a298-4abd-5432-b135-d829a61c288b","party":"SPD","share":33.58124,"source_row":30,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"52105440-18c3-5eaf-9a0e-aa270495ac90","district_id":"e705a298-4abd-5432-b135-d829a61c288b","party":"FDP","share":30.77005,"source_row":30,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4fe4817a-28c3-5b33-92b9-84989efa86c3","district_id":"7c845721-95fa-5ed7-927a-7647eed4ee1d","party":"CDU","share":16.54452,"source_row":31,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4fe4817a-28c3-5b33-92b9-84989efa86c3","district_id":"7c845721-95fa-5ed7-927a-7647eed4ee1d","party":"SPD","share":43.12777,"source_row":31,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4fe4817a-28c3-5b33-92b9-84989efa86c3","district_id":"7c845721-95fa-5ed7-927a-7647eed4ee1d","party":"FDP","share":23.44441,"source_row":31,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3d611701-bf3c-5c41-a343-0fc6c529b795","district_id":"c2896957-eb16-5c79-a83d-d07f7f5ec374","party":"CDU","share":31.59229,"source_row":32,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3d611701-bf3c-5c41-a343-0fc6c529b795","district_id":"c2896957-eb16-5c79-a83d-d07f7f5ec374","party":"SPD","share":32.28338,"source_row":32,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"3d611701-bf3c-5c41-a343-0fc6c529b795","district_id":"c2896957-eb16-5c79-a83d-d07f7f5ec374","party":"FDP","share":11.94652,"source_row":32,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f4802491-57f9-5fd8-840d-b5cb4ed900f1","district_id":"b27e542c-f72f-50f6-ab47-6e3539497433","party":"CDU","share":47.60284,"source_row":33,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f4802491-57f9-5fd8-840d-b5cb4ed900f1","district_id":"b27e542c-f72f-50f6-ab47-6e3539497433","party":"SPD","share":27.52193,"source_row":33,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f4802491-57f9-5fd8-840d-b5cb4ed900f1","district_id":"b27e542c-f72f-50f6-ab47-6e3539497433","party":"FDP","share":6.44283,"source_row":33,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9ccebad5-84ab-5492-9c6a-eb5d93fcb247","district_id":"75be69f2-b103-5d79-ab0d-d916efb9fec0","party":"CDU","share":30.6737,"source_row":34,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9ccebad5-84ab-5492-9c6a-eb5d93fcb247","district_id":"75be69f2-b103-5d79-ab0d-d916efb9fec0","party":"SPD","share":37.6989,"source_row":34,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9ccebad5-84ab-5492-9c6a-eb5d93fcb247","district_id":"75be69f2-b103-5d79-ab0d-d916efb9fec0","party":"FDP","share":13.41034,"source_row":34,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"2a98c0f7-bdeb-563b-a1c8-643b4cb389eb","district_id":"c296272e-09fb-55ea-81cd-e7f0aee42df5","party":"CDU","share":34.98415,"source_row":35,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"2a98c0f7-bdeb-563b-a1c8-643b4cb389eb","district_id":"c296272e-09fb-55ea-81cd-e7f0aee42df5","party":"SPD","share":28.75618,"source_row":35,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"2a98c0f7-bdeb-563b-a1c8-643b4cb389eb","district_id":"c296272e-09fb-55ea-81cd-e7f0aee42df5","party":"FDP","share":17.9612,"source_row":35,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"220a60f7-8e34-5de8-bea4-59da134c77ff","district_id":"7cf4af4a-af25-5a24-9cec-f208cdbb12b5","party":"CDU","share":46.08297,"source_row":36,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"220a60f7-8e34-5de8-bea4-59da134c77ff","district_id":"7cf4af4a-af25-5a24-9cec-f208cdbb12b5","party":"SPD","share":27.29248,"source_row":36,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"220a60f7-8e34-5de8-bea4-59da134c77ff","district_id":"7cf4af4a-af25-5a24-9cec-f208cdbb12b5","party":"FDP","share":18.87096,"source_row":36,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b4702ab5-721a-5eae-aa7f-ba44e748ef00","district_id":"fd6754ef-882e-5415-bd71-022d91228ca0","party":"CDU","share":38.73564,"source_row":37,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b4702ab5-721a-5eae-aa7f-ba44e748ef00","district_id":"fd6754ef-882e-5415-bd71-022d91228ca0","party":"SPD","share":30.40037,"source_row":37,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b4702ab5-721a-5eae-aa7f-ba44e748ef00","district_id":"fd6754ef-882e-5415-bd71-022d91228ca0","party":"FDP","share":14.2332,"source_row":37,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"168527b8-aae7-5808-a371-c134be1cb38e","district_id":"021f0f85-da2c-54e4-9ddd-7a7f376d06e1","party":"CDU","share":50.52372,"source_row":38,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"168527b8-aae7-5808-a371-c134be1cb38e","district_id":"021f0f85-da2c-54e4-9ddd-7a7f376d06e1","party":"SPD","share":18.65679,"source_row":38,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"168527b8-aae7-5808-a371-c134be1cb38e","district_id":"021f0f85-da2c-54e4-9ddd-7a7f376d06e1","party":"FDP","share":21.96479,"source_row":38,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"effd719b-6ceb-526c-a7ad-ef66bc761b31","district_id":"b8d648ac-c041-5e1b-ab2a-1307cae0787a","party":"CDU","share":27.24866,"source_row":39,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"effd719b-6ceb-526c-a7ad-ef66bc761b31","district_id":"b8d648ac-c041-5e1b-ab2a-1307cae0787a","party":"SPD","share":27.84943,"source_row":39,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"effd719b-6ceb-526c-a7ad-ef66bc761b31","district_id":"b8d648ac-c041-5e1b-ab2a-1307cae0787a","party":"FDP","share":18.24723,"source_row":39,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ad294d1e-84c1-50ae-9d28-ace109988509","district_id":"5d7f37ee-69ef-53e9-a775-b3f65ed266d4","party":"CDU","share":31.46071,"source_row":40,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ad294d1e-84c1-50ae-9d28-ace109988509","district_id":"5d7f37ee-69ef-53e9-a775-b3f65ed266d4","party":"SPD","share":37.60719,"source_row":40,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ad294d1e-84c1-50ae-9d28-ace109988509","district_id":"5d7f37ee-69ef-53e9-a775-b3f65ed266d4","party":"FDP","share":16.26924,"source_row":40,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"68179c4d-3bee-5b87-8354-6b0a73157086","district_id":"8121d8d5-4fbf-5cf3-81f5-e081f6f523f4","party":"CDU","share":15.40402,"source_row":41,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"68179c4d-3bee-5b87-8354-6b0a73157086","district_id":"8121d8d5-4fbf-5cf3-81f5-e081f6f523f4","party":"SPD","share":27.37414,"source_row":41,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"68179c4d-3bee-5b87-8354-6b0a73157086","district_id":"8121d8d5-4fbf-5cf3-81f5-e081f6f523f4","party":"FDP","share":32.65836,"source_row":41,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e016290e-19da-5e48-8d99-22b7e7ecdbc5","district_id":"9b189de4-0b35-5767-83c0-05887823f001","party":"CDU","share":14.36761,"source_row":42,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e016290e-19da-5e48-8d99-22b7e7ecdbc5","district_id":"9b189de4-0b35-5767-83c0-05887823f001","party":"SPD","share":34.11756,"source_row":42,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e016290e-19da-5e48-8d99-22b7e7ecdbc5","district_id":"9b189de4-0b35-5767-83c0-05887823f001","party":"FDP","share":27.67431,"source_row":42,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f9298652-ca4b-541b-955f-67099d727f16","district_id":"25f18483-edc0-5221-a894-591ecda4398f","party":"CDU","share":34.00404,"source_row":43,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f9298652-ca4b-541b-955f-67099d727f16","district_id":"25f18483-edc0-5221-a894-591ecda4398f","party":"SPD","share":28.41447,"source_row":43,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f9298652-ca4b-541b-955f-67099d727f16","district_id":"25f18483-edc0-5221-a894-591ecda4398f","party":"FDP","share":14.654,"source_row":43,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"0039e4dd-dfc1-5eb3-8940-a3a39f63661a","district_id":"66642413-469c-5659-9cb9-a69ce189759c","party":"CDU","share":28.13763,"source_row":44,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"0039e4dd-dfc1-5eb3-8940-a3a39f63661a","district_id":"66642413-469c-5659-9cb9-a69ce189759c","party":"SPD","share":36.78058,"source_row":44,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"0039e4dd-dfc1-5eb3-8940-a3a39f63661a","district_id":"66642413-469c-5659-9cb9-a69ce189759c","party":"FDP","share":14.20955,"source_row":44,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"d6e496f0-a5bf-5679-82d7-1e720fa22414","district_id":"f9fcb716-2ca2-5b80-817a-320647759c9b","party":"CDU","share":23.5056,"source_row":45,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"d6e496f0-a5bf-5679-82d7-1e720fa22414","district_id":"f9fcb716-2ca2-5b80-817a-320647759c9b","party":"SPD","share":41.54316,"source_row":45,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"d6e496f0-a5bf-5679-82d7-1e720fa22414","district_id":"f9fcb716-2ca2-5b80-817a-320647759c9b","party":"FDP","share":11.75717,"source_row":45,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"530bc204-b465-5960-80e8-4683074be1e4","district_id":"67a98e4a-44a0-583b-aaca-babea67fecae","party":"CDU","share":22.41098,"source_row":46,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"530bc204-b465-5960-80e8-4683074be1e4","district_id":"67a98e4a-44a0-583b-aaca-babea67fecae","party":"SPD","share":46.51774,"source_row":46,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"530bc204-b465-5960-80e8-4683074be1e4","district_id":"67a98e4a-44a0-583b-aaca-babea67fecae","party":"FDP","share":9.99033,"source_row":46,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1a9f25e9-3a33-528d-8edf-70ebbff4e7d1","district_id":"44cbef32-eb90-5cda-94d9-8bb41709d696","party":"CDU","share":26.9819,"source_row":47,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1a9f25e9-3a33-528d-8edf-70ebbff4e7d1","district_id":"44cbef32-eb90-5cda-94d9-8bb41709d696","party":"SPD","share":40.88453,"source_row":47,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1a9f25e9-3a33-528d-8edf-70ebbff4e7d1","district_id":"44cbef32-eb90-5cda-94d9-8bb41709d696","party":"FDP","share":15.48305,"source_row":47,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"99b7d258-1adf-5f49-bded-e4bd599a5e46","district_id":"7e55760f-b428-5183-8a64-3485f86a3d9c","party":"CDU","share":37.36398,"source_row":48,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"99b7d258-1adf-5f49-bded-e4bd599a5e46","district_id":"7e55760f-b428-5183-8a64-3485f86a3d9c","party":"SPD","share":20.97894,"source_row":48,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"99b7d258-1adf-5f49-bded-e4bd599a5e46","district_id":"7e55760f-b428-5183-8a64-3485f86a3d9c","party":"FDP","share":10.73272,"source_row":48,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"10937b87-2093-575a-8e59-7874ba64353b","district_id":"e1cfda26-e207-5848-b2ea-9975eb0faad2","party":"CDU","share":32.35477,"source_row":49,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"10937b87-2093-575a-8e59-7874ba64353b","district_id":"e1cfda26-e207-5848-b2ea-9975eb0faad2","party":"SPD","share":34.03619,"source_row":49,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"10937b87-2093-575a-8e59-7874ba64353b","district_id":"e1cfda26-e207-5848-b2ea-9975eb0faad2","party":"FDP","share":21.6954,"source_row":49,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1e29369a-8d96-5003-954b-c87d421385c1","district_id":"5b6809b0-820b-51d6-912d-2336692c1fb0","party":"CDU","share":52.17564,"source_row":50,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1e29369a-8d96-5003-954b-c87d421385c1","district_id":"5b6809b0-820b-51d6-912d-2336692c1fb0","party":"SPD","share":15.13262,"source_row":50,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1e29369a-8d96-5003-954b-c87d421385c1","district_id":"5b6809b0-820b-51d6-912d-2336692c1fb0","party":"FDP","share":20.97655,"source_row":50,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8668beda-c120-58b8-82d8-ad576a8d8c3f","district_id":"b33d1847-113d-5592-8c0b-df27c5368eed","party":"CDU","share":20.98781,"source_row":51,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8668beda-c120-58b8-82d8-ad576a8d8c3f","district_id":"b33d1847-113d-5592-8c0b-df27c5368eed","party":"SPD","share":34.80193,"source_row":51,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"8668beda-c120-58b8-82d8-ad576a8d8c3f","district_id":"b33d1847-113d-5592-8c0b-df27c5368eed","party":"FDP","share":14.22676,"source_row":51,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f3ffca91-72fb-5c67-bce1-c87de7192984","district_id":"fd564eea-ec46-573c-a0b1-4f493c0711cb","party":"CDU","share":51.29885,"source_row":52,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f3ffca91-72fb-5c67-bce1-c87de7192984","district_id":"fd564eea-ec46-573c-a0b1-4f493c0711cb","party":"SPD","share":21.01861,"source_row":52,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"f3ffca91-72fb-5c67-bce1-c87de7192984","district_id":"fd564eea-ec46-573c-a0b1-4f493c0711cb","party":"FDP","share":13.07044,"source_row":52,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e04bdcd8-3d25-5fce-bccf-f6b7159ebbcd","district_id":"b797f9fb-9627-5731-9b2f-e594df481d4f","party":"CDU","share":41.70277,"source_row":53,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e04bdcd8-3d25-5fce-bccf-f6b7159ebbcd","district_id":"b797f9fb-9627-5731-9b2f-e594df481d4f","party":"SPD","share":14.23122,"source_row":53,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e04bdcd8-3d25-5fce-bccf-f6b7159ebbcd","district_id":"b797f9fb-9627-5731-9b2f-e594df481d4f","party":"FDP","share":25.44,"source_row":53,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"67db775a-51d3-5123-b433-c438b76cc40f","district_id":"243fc10f-4ed5-50f2-8d9a-bf5ac6a9346f","party":"CDU","share":17.57485,"source_row":54,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"67db775a-51d3-5123-b433-c438b76cc40f","district_id":"243fc10f-4ed5-50f2-8d9a-bf5ac6a9346f","party":"SPD","share":38.3747,"source_row":54,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"67db775a-51d3-5123-b433-c438b76cc40f","district_id":"243fc10f-4ed5-50f2-8d9a-bf5ac6a9346f","party":"FDP","share":28.60092,"source_row":54,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"bfc0aad2-2d7c-5b0e-acb8-6a922f4dd597","district_id":"8048ffee-37d7-53fb-9324-e8d6b48d22fc","party":"CDU","share":43.74221,"source_row":55,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"bfc0aad2-2d7c-5b0e-acb8-6a922f4dd597","district_id":"8048ffee-37d7-53fb-9324-e8d6b48d22fc","party":"SPD","share":27.13784,"source_row":55,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"bfc0aad2-2d7c-5b0e-acb8-6a922f4dd597","district_id":"8048ffee-37d7-53fb-9324-e8d6b48d22fc","party":"FDP","share":9.69249,"source_row":55,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"649b106c-d7a8-55fe-857e-ec3d0576192f","district_id":"1badf02f-da2a-5fd8-8eca-7427773341ea","party":"CDU","share":60.45889,"source_row":56,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"649b106c-d7a8-55fe-857e-ec3d0576192f","district_id":"1badf02f-da2a-5fd8-8eca-7427773341ea","party":"SPD","share":20.22095,"source_row":56,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"649b106c-d7a8-55fe-857e-ec3d0576192f","district_id":"1badf02f-da2a-5fd8-8eca-7427773341ea","party":"FDP","share":10.71595,"source_row":56,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"734f8331-642a-5109-a0a3-1fa610e6538e","district_id":"2108f140-facc-5bc2-932b-98e278def77b","party":"CDU","share":22.3933,"source_row":57,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"734f8331-642a-5109-a0a3-1fa610e6538e","district_id":"2108f140-facc-5bc2-932b-98e278def77b","party":"SPD","share":37.54085,"source_row":57,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"734f8331-642a-5109-a0a3-1fa610e6538e","district_id":"2108f140-facc-5bc2-932b-98e278def77b","party":"FDP","share":24.88198,"source_row":57,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b5c9a553-e385-5066-880d-f9c708b9fb1c","district_id":"118e2763-5abe-56fc-8121-20b0762cb138","party":"CDU","share":56.89934,"source_row":58,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b5c9a553-e385-5066-880d-f9c708b9fb1c","district_id":"118e2763-5abe-56fc-8121-20b0762cb138","party":"SPD","share":21.67166,"source_row":58,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b5c9a553-e385-5066-880d-f9c708b9fb1c","district_id":"118e2763-5abe-56fc-8121-20b0762cb138","party":"FDP","share":11.93829,"source_row":58,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"16bfbf56-ab9c-5239-a998-823aff06665e","district_id":"c3d90ce5-dc77-5929-afab-740c067b767b","party":"CDU","share":69.65387,"source_row":59,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"16bfbf56-ab9c-5239-a998-823aff06665e","district_id":"c3d90ce5-dc77-5929-afab-740c067b767b","party":"SPD","share":8.46831,"source_row":59,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"16bfbf56-ab9c-5239-a998-823aff06665e","district_id":"c3d90ce5-dc77-5929-afab-740c067b767b","party":"FDP","share":12.69424,"source_row":59,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4cd8bd21-2cb1-5904-bbb6-f6f808be1ae4","district_id":"53480937-f528-5283-9842-dc8f1cab1bfd","party":"CDU","share":36.59557,"source_row":60,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4cd8bd21-2cb1-5904-bbb6-f6f808be1ae4","district_id":"53480937-f528-5283-9842-dc8f1cab1bfd","party":"SPD","share":19.94341,"source_row":60,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4cd8bd21-2cb1-5904-bbb6-f6f808be1ae4","district_id":"53480937-f528-5283-9842-dc8f1cab1bfd","party":"FDP","share":19.74995,"source_row":60,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7a49d762-93d3-55dc-b729-9321d50e2a6d","district_id":"c8553b4c-4714-53fc-9da1-aecd75039f66","party":"CDU","share":23.90044,"source_row":61,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7a49d762-93d3-55dc-b729-9321d50e2a6d","district_id":"c8553b4c-4714-53fc-9da1-aecd75039f66","party":"SPD","share":19.12896,"source_row":61,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7a49d762-93d3-55dc-b729-9321d50e2a6d","district_id":"c8553b4c-4714-53fc-9da1-aecd75039f66","party":"FDP","share":26.92639,"source_row":61,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"13fb35f0-7635-57dc-914e-78d461a7819c","district_id":"b6deefd4-ce68-5b07-a72e-1d430a32ee3d","party":"CDU","share":47.05362,"source_row":62,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"13fb35f0-7635-57dc-914e-78d461a7819c","district_id":"b6deefd4-ce68-5b07-a72e-1d430a32ee3d","party":"SPD","share":28.23807,"source_row":62,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"13fb35f0-7635-57dc-914e-78d461a7819c","district_id":"b6deefd4-ce68-5b07-a72e-1d430a32ee3d","party":"FDP","share":13.88634,"source_row":62,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1fd6d90d-add1-55a8-b917-8b48fbbf89e1","district_id":"711dcbdb-e887-504a-8421-abbdca44dc96","party":"CDU","share":19.17886,"source_row":63,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1fd6d90d-add1-55a8-b917-8b48fbbf89e1","district_id":"711dcbdb-e887-504a-8421-abbdca44dc96","party":"SPD","share":30.70613,"source_row":63,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1fd6d90d-add1-55a8-b917-8b48fbbf89e1","district_id":"711dcbdb-e887-504a-8421-abbdca44dc96","party":"FDP","share":33.62267,"source_row":63,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4beda0d5-44bd-5033-a4e1-4f0633d7230b","district_id":"ca13f96b-9719-5970-a91b-11c9c3f6675c","party":"CDU","share":18.07501,"source_row":64,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4beda0d5-44bd-5033-a4e1-4f0633d7230b","district_id":"ca13f96b-9719-5970-a91b-11c9c3f6675c","party":"SPD","share":35.49303,"source_row":64,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"4beda0d5-44bd-5033-a4e1-4f0633d7230b","district_id":"ca13f96b-9719-5970-a91b-11c9c3f6675c","party":"FDP","share":28.45162,"source_row":64,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"50d5210d-3f8c-5b58-bff7-413611115cb0","district_id":"133f3850-7c17-594b-b5e9-dce1dd803cd0","party":"CDU","share":17.84706,"source_row":65,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"50d5210d-3f8c-5b58-bff7-413611115cb0","district_id":"133f3850-7c17-594b-b5e9-dce1dd803cd0","party":"SPD","share":36.4265,"source_row":65,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"50d5210d-3f8c-5b58-bff7-413611115cb0","district_id":"133f3850-7c17-594b-b5e9-dce1dd803cd0","party":"FDP","share":30.31995,"source_row":65,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7994a760-5ce3-5306-ac70-c96e4dbf91af","district_id":"7ca92996-8791-5720-b66c-b6c61908daf2","party":"CDU","share":14.02341,"source_row":66,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7994a760-5ce3-5306-ac70-c96e4dbf91af","district_id":"7ca92996-8791-5720-b66c-b6c61908daf2","party":"SPD","share":39.2882,"source_row":66,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"7994a760-5ce3-5306-ac70-c96e4dbf91af","district_id":"7ca92996-8791-5720-b66c-b6c61908daf2","party":"FDP","share":26.53856,"source_row":66,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"232d521f-e9d4-5e0b-a96b-d2085ce3b1fe","district_id":"c3438158-8f53-5044-a5f7-bf888de0026b","party":"CDU","share":17.00762,"source_row":67,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"232d521f-e9d4-5e0b-a96b-d2085ce3b1fe","district_id":"c3438158-8f53-5044-a5f7-bf888de0026b","party":"SPD","share":38.73552,"source_row":67,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"232d521f-e9d4-5e0b-a96b-d2085ce3b1fe","district_id":"c3438158-8f53-5044-a5f7-bf888de0026b","party":"FDP","share":25.55881,"source_row":67,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"321f76ab-f6ef-5916-891c-489d6f5355f6","district_id":"adfa8a2d-6924-5593-bca6-1a38be9bb3fd","party":"CDU","share":53.34201,"source_row":68,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"321f76ab-f6ef-5916-891c-489d6f5355f6","district_id":"adfa8a2d-6924-5593-bca6-1a38be9bb3fd","party":"SPD","share":17.88127,"source_row":68,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"321f76ab-f6ef-5916-891c-489d6f5355f6","district_id":"adfa8a2d-6924-5593-bca6-1a38be9bb3fd","party":"FDP","share":15.69388,"source_row":68,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1ebee5ad-6815-5b59-a6fb-13c17560777b","district_id":"0d868e21-6aaa-56e4-a54e-105588bd6dc6","party":"CDU","share":40.02909,"source_row":69,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1ebee5ad-6815-5b59-a6fb-13c17560777b","district_id":"0d868e21-6aaa-56e4-a54e-105588bd6dc6","party":"SPD","share":27.95571,"source_row":69,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"1ebee5ad-6815-5b59-a6fb-13c17560777b","district_id":"0d868e21-6aaa-56e4-a54e-105588bd6dc6","party":"FDP","share":18.94782,"source_row":69,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"86228c27-c81d-5460-b8dc-7ad07063c0a3","district_id":"cb0713f4-cbac-5c75-8c32-714793cee0d3","party":"CDU","share":43.11431,"source_row":70,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"86228c27-c81d-5460-b8dc-7ad07063c0a3","district_id":"cb0713f4-cbac-5c75-8c32-714793cee0d3","party":"SPD","share":29.87299,"source_row":70,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"86228c27-c81d-5460-b8dc-7ad07063c0a3","district_id":"cb0713f4-cbac-5c75-8c32-714793cee0d3","party":"FDP","share":15.89675,"source_row":70,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b51ee446-2014-5a0d-808c-315f5553ed09","district_id":"338b77a3-0a9a-57e5-94f5-85435312c678","party":"CDU","share":39.50924,"source_row":71,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b51ee446-2014-5a0d-808c-315f5553ed09","district_id":"338b77a3-0a9a-57e5-94f5-85435312c678","party":"SPD","share":16.98743,"source_row":71,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b51ee446-2014-5a0d-808c-315f5553ed09","district_id":"338b77a3-0a9a-57e5-94f5-85435312c678","party":"FDP","share":10.66557,"source_row":71,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"565548f7-4dfd-5edd-9a81-a14b91d80ac2","district_id":"7777dff8-fff4-5e6e-b6b9-66975c95768c","party":"CDU","share":52.66623,"source_row":72,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"565548f7-4dfd-5edd-9a81-a14b91d80ac2","district_id":"7777dff8-fff4-5e6e-b6b9-66975c95768c","party":"SPD","share":22.51413,"source_row":72,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"565548f7-4dfd-5edd-9a81-a14b91d80ac2","district_id":"7777dff8-fff4-5e6e-b6b9-66975c95768c","party":"FDP","share":7.81532,"source_row":72,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e6a0fbbc-c069-59d9-93f9-f4f7bb7584ee","district_id":"5d19705a-04ce-581c-97a5-f867a91f143e","party":"CDU","share":28.87103,"source_row":73,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e6a0fbbc-c069-59d9-93f9-f4f7bb7584ee","district_id":"5d19705a-04ce-581c-97a5-f867a91f143e","party":"SPD","share":34.73769,"source_row":73,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e6a0fbbc-c069-59d9-93f9-f4f7bb7584ee","district_id":"5d19705a-04ce-581c-97a5-f867a91f143e","party":"FDP","share":25.13263,"source_row":73,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e2247631-9e6f-5620-955f-923f5ac635d6","district_id":"45c2729e-b3e4-5dd2-a4f5-706f0cebfdb5","party":"CDU","share":0,"source_row":74,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e2247631-9e6f-5620-955f-923f5ac635d6","district_id":"45c2729e-b3e4-5dd2-a4f5-706f0cebfdb5","party":"SPD","share":27.48147,"source_row":74,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"e2247631-9e6f-5620-955f-923f5ac635d6","district_id":"45c2729e-b3e4-5dd2-a4f5-706f0cebfdb5","party":"FDP","share":42.1165,"source_row":74,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ee2b0665-ff3d-5241-9757-b4e4e2ee2a6a","district_id":"7f88441f-36a9-57fd-9a78-d9b5c2612161","party":"CDU","share":42.48773,"source_row":75,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ee2b0665-ff3d-5241-9757-b4e4e2ee2a6a","district_id":"7f88441f-36a9-57fd-9a78-d9b5c2612161","party":"SPD","share":28.51449,"source_row":75,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"ee2b0665-ff3d-5241-9757-b4e4e2ee2a6a","district_id":"7f88441f-36a9-57fd-9a78-d9b5c2612161","party":"FDP","share":17.74744,"source_row":75,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9cd87d20-0d4f-58f0-ab61-263606525d4f","district_id":"0f0fefe5-51fd-5b88-8dd4-d30f5b8352c1","party":"CDU","share":21.79863,"source_row":76,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9cd87d20-0d4f-58f0-ab61-263606525d4f","district_id":"0f0fefe5-51fd-5b88-8dd4-d30f5b8352c1","party":"SPD","share":29.7288,"source_row":76,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"9cd87d20-0d4f-58f0-ab61-263606525d4f","district_id":"0f0fefe5-51fd-5b88-8dd4-d30f5b8352c1","party":"FDP","share":21.15337,"source_row":76,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"040038db-04dc-57c6-a77e-5c0915bcb2c0","district_id":"5182c5ec-5d68-52dd-89c7-79eeda129759","party":"CDU","share":22.99032,"source_row":77,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"040038db-04dc-57c6-a77e-5c0915bcb2c0","district_id":"5182c5ec-5d68-52dd-89c7-79eeda129759","party":"SPD","share":22.38046,"source_row":77,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"040038db-04dc-57c6-a77e-5c0915bcb2c0","district_id":"5182c5ec-5d68-52dd-89c7-79eeda129759","party":"FDP","share":31.89358,"source_row":77,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"08b9416a-8464-50de-afcd-cf9799d92e55","district_id":"30e2faf8-1352-57b6-8da3-e43351f68461","party":"CDU","share":43.38183,"source_row":78,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"08b9416a-8464-50de-afcd-cf9799d92e55","district_id":"30e2faf8-1352-57b6-8da3-e43351f68461","party":"SPD","share":25.63832,"source_row":78,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"08b9416a-8464-50de-afcd-cf9799d92e55","district_id":"30e2faf8-1352-57b6-8da3-e43351f68461","party":"FDP","share":14.54598,"source_row":78,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b31c3044-7e98-51e3-b240-0f3d5846f515","district_id":"dea74ce1-73e5-5934-973a-076a163fa111","party":"CDU","share":75.97273,"source_row":79,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b31c3044-7e98-51e3-b240-0f3d5846f515","district_id":"dea74ce1-73e5-5934-973a-076a163fa111","party":"SPD","share":12.89183,"source_row":79,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"},
{"source_mandate_id":"b31c3044-7e98-51e3-b240-0f3d5846f515","district_id":"dea74ce1-73e5-5934-973a-076a163fa111","party":"FDP","share":4.29147,"source_row":79,"source_url":"https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf"}
]$original_1952$::jsonb)
 AS x(source_mandate_id uuid,district_id uuid,party text,share numeric,source_row integer,source_url text)
 JOIN public.election_history_mandates m ON m.id=x.source_mandate_id AND m.district_id=x.district_id
 JOIN public.election_history_periods p ON p.id=m.period_id AND p.number=1 AND p.election_year=1952
 WHERE m.entry_type='election' AND m.mandate_type='direct'
 ON CONFLICT(district_id,party) DO NOTHING;

CREATE OR REPLACE FUNCTION public.history_result_party(label text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE upper(btrim($1)) WHEN 'FDP/DVP' THEN 'FDP' WHEN 'FDP' THEN 'FDP'
 WHEN 'GRÜNE' THEN 'GRÜNE' WHEN 'BÜNDNIS 90/DIE GRÜNEN' THEN 'GRÜNE'
 WHEN 'AFD' THEN 'AfD' ELSE btrim($1) END;
$$;

REVOKE ALL ON FUNCTION public.history_result_party(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.history_result_party(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.assemble_election_history(selected_period uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $assemble$
DECLARE m record; legacy record; next_votes bigint; next_share numeric; next_snapshot jsonb; c public.election_history_candidacies; r public.election_analysis_districts;
 target_person uuid; identity_count integer; candidate_count integer;
 previous_flag text:=coalesce(current_setting('app.assembling_election_history',true),'');
BEGIN
 IF previous_flag='on' THEN RETURN; END IF;
 IF NOT coalesce(public.is_superadmin(auth.uid()),false)
    AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
  RAISE EXCEPTION 'Nur Super-Admins dürfen Wahldaten zusammenführen' USING ERRCODE='42501';
 END IF;
 -- Same lock as the existing candidacy/mandate guards: serialize per period.
 PERFORM 1 FROM public.election_history_periods WHERE id=$1 FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM set_config('app.assembling_election_history','on',true);
 DELETE FROM public.election_history_assembly_issues WHERE period_id=$1;
 FOR m IN
  SELECT mandates.*,p.election_year,p.source_url AS period_source
  FROM public.election_history_mandates mandates JOIN public.election_history_periods p ON p.id=mandates.period_id
  WHERE mandates.period_id=$1 AND mandates.entry_type='election'
  ORDER BY mandates.id
 LOOP
  BEGIN
   target_person:=NULL;
   -- A confirmed connection is the identity key. A name is only a display label.
   IF m.connection_id IS NULL AND m.person_id IS NULL THEN
    RAISE EXCEPTION 'Personenverbindung fehlt';
   END IF;
   IF m.connection_id IS NOT NULL THEN
    SELECT count(DISTINCT person_id) INTO identity_count FROM public.election_history_mandates
     WHERE connection_id=m.connection_id AND person_id IS NOT NULL;
    IF identity_count>1 THEN RAISE EXCEPTION 'Bestehende Verbindung enthält verschiedene Personen-IDs'; END IF;
    SELECT person_id INTO target_person FROM public.election_history_connection_people WHERE connection_id=m.connection_id;
    IF target_person IS NOT NULL AND EXISTS(SELECT 1 FROM public.election_history_mandates
       WHERE connection_id=m.connection_id AND person_id IS NOT NULL AND person_id<>target_person) THEN
      RAISE EXCEPTION 'Personen-ID widerspricht der bestehenden Verbindung';
    END IF;
    IF target_person IS NULL THEN
     SELECT person_id INTO target_person FROM public.election_history_mandates
      WHERE connection_id=m.connection_id AND person_id IS NOT NULL LIMIT 1;
     IF target_person IS NULL THEN
      INSERT INTO public.election_history_people(name,source_url)
       VALUES(m.person_name,m.source_url) RETURNING id INTO target_person;
     END IF;
     INSERT INTO public.election_history_connection_people VALUES(m.connection_id,target_person);
    END IF;
   ELSE target_person:=m.person_id;
   END IF;
   IF m.person_id IS NOT NULL AND m.person_id<>target_person THEN RAISE EXCEPTION 'Vorhandene Personen-ID bleibt geschützt'; END IF;
   IF m.election_year IS NULL THEN RAISE EXCEPTION 'Wahljahr fehlt'; END IF;
   -- A source-assigned constituency is reused even for elected list candidates.
   -- A genuinely statewide list entry with no district has no personal result.
   IF m.district_id IS NULL AND m.mandate_type='list' THEN
    IF m.candidacy_id IS NOT NULL THEN CONTINUE; END IF;
    SELECT * INTO c FROM public.election_history_candidacies WHERE period_id=m.period_id AND person_id=target_person;
    IF NOT FOUND THEN
     INSERT INTO public.election_history_candidacies(period_id,person_id,party,ballot_type,outcome,source_url,notes)
      VALUES(m.period_id,target_person,m.party,CASE WHEN m.election_year>=2026 THEN 'first_vote' ELSE 'candidate' END,'list',coalesce(m.source_url,m.period_source),
       'Listeneinzug aus vorhandenem ursprünglichem Wahlmandat; keine Wahlkreiskandidatur oder Erststimmen daraus abgeleitet.') RETURNING * INTO c;
    END IF;
    -- Keep any separately known district candidacy independent of this list mandate.
    UPDATE public.election_history_mandates SET person_id=target_person,candidacy_id=CASE WHEN c.district_id IS NULL AND c.outcome='list' THEN c.id ELSE candidacy_id END
      WHERE id=m.id AND (person_id IS NULL OR (candidacy_id IS NULL AND c.district_id IS NULL AND c.outcome='list'));
    IF EXISTS(SELECT 1 FROM public.election_history_mandates changed WHERE changed.id=m.id
      AND (changed.starts_on IS DISTINCT FROM m.starts_on OR changed.ends_on IS DISTINCT FROM m.ends_on
       OR changed.start_from_period IS DISTINCT FROM m.start_from_period OR changed.end_from_period IS DISTINCT FROM m.end_from_period)) THEN
     RAISE EXCEPTION 'Bestehende Mandatstermine dürfen bei der Zuordnung nicht verändert werden';
    END IF;
    CONTINUE;
   END IF;
   IF m.district_id IS NULL THEN RAISE EXCEPTION 'Historischer Wahlkreis fehlt'; END IF;
   IF EXISTS(SELECT 1 FROM public.election_history_mandates other
       WHERE other.period_id=m.period_id AND other.entry_type='election' AND other.id<>m.id
       AND (other.person_id=target_person OR (m.connection_id IS NOT NULL AND other.connection_id=m.connection_id))) THEN
    RAISE EXCEPTION 'Mehrere ursprüngliche Wahlmandate derselben Person in dieser Periode';
   END IF;
   SELECT * INTO c FROM public.election_history_candidacies WHERE period_id=m.period_id AND person_id=target_person;
   IF FOUND THEN
    IF c.district_id IS DISTINCT FROM m.district_id
       OR public.history_result_party(c.party)<>public.history_result_party(m.party)
       OR c.outcome<>m.mandate_type
       OR c.ballot_type<>(CASE WHEN m.election_year>=2026 THEN 'first_vote' ELSE 'candidate' END) THEN
      RAISE EXCEPTION 'Vorhandene Kandidatur widerspricht dem Wahlmandat';
    END IF;
   ELSE
    INSERT INTO public.election_history_candidacies(period_id,person_id,district_id,party,ballot_type,outcome,source_url,notes)
     VALUES(m.period_id,target_person,m.district_id,m.party,
       CASE WHEN m.election_year>=2026 THEN 'first_vote' ELSE 'candidate' END,m.mandate_type,
       coalesce(m.source_url,m.period_source),'Automatisch aus vorhandenem ursprünglichem Wahlmandat angelegt; keine Namen zusammengeführt.') RETURNING * INTO c;
   END IF;
   IF m.candidacy_id IS NOT NULL AND m.candidacy_id<>c.id THEN
     RAISE EXCEPTION 'Mandat ist bereits mit einer anderen Kandidatur verbunden';
   END IF;
   UPDATE public.election_history_mandates SET person_id=target_person,candidacy_id=c.id
    WHERE id=m.id AND (person_id IS DISTINCT FROM target_person OR candidacy_id IS DISTINCT FROM c.id);
   IF EXISTS(SELECT 1 FROM public.election_history_mandates changed WHERE changed.id=m.id
     AND (changed.starts_on IS DISTINCT FROM m.starts_on OR changed.ends_on IS DISTINCT FROM m.ends_on
      OR changed.start_from_period IS DISTINCT FROM m.start_from_period OR changed.end_from_period IS DISTINCT FROM m.end_from_period)) THEN
    RAISE EXCEPTION 'Bestehende Mandatstermine dürfen bei der Zuordnung nicht verändert werden';
   END IF;
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'mandate:'||m.id,'Zusammenführung nicht eindeutig',SQLERRM)
    ON CONFLICT(period_id,record_key) DO UPDATE SET reason=excluded.reason,details=excluded.details;
  END;
 END LOOP;
 -- Include pre-existing unsuccessful candidacies; never infer them from mandates.
 FOR c IN SELECT * FROM public.election_history_candidacies WHERE period_id=$1 AND district_id IS NOT NULL LOOP
  BEGIN
  SELECT count(*) INTO candidate_count FROM public.election_history_candidacies other
   WHERE other.period_id=c.period_id AND other.district_id=c.district_id
    AND public.history_result_party(other.party)=public.history_result_party(c.party)
    AND other.ballot_type=c.ballot_type;
  IF candidate_count<>1 THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'candidate:'||c.id,'Mehrdeutige Parteikandidatur',NULL)
    ON CONFLICT DO NOTHING; CONTINUE;
  END IF;
  SELECT result.* INTO r FROM public.election_analysis_years y
   JOIN public.election_history_periods p ON p.id=y.period_id AND p.election_year=y.year AND p.number=y.period_number
   JOIN public.election_analysis_versions v ON v.year=y.year AND v.historical_district_id=c.district_id AND v.history_link_verified
   JOIN public.election_analysis_districts result ON result.year=v.year AND result.district_number=v.district_number
    AND result.party=public.history_result_party(c.party)
    AND result.ballot=CASE WHEN p.election_year>=2026 THEN 'first' ELSE 'single' END
   WHERE y.period_id=$1 AND c.ballot_type=CASE WHEN p.election_year>=2026 THEN 'first_vote' ELSE 'candidate' END;
  IF r.year IS NULL THEN
   SELECT source.* INTO legacy FROM public.election_history_1952_result_sources source
    JOIN public.election_history_mandates m ON m.id=source.source_mandate_id AND m.district_id=source.district_id
    JOIN public.election_history_periods p ON p.id=m.period_id AND p.election_year=1952 AND p.number=1
    WHERE source.district_id=c.district_id AND m.period_id=c.period_id AND c.ballot_type='candidate'
     AND source.party=public.history_result_party(c.party);
   IF FOUND THEN
    r.year:=1952; r.ballot:='single'; r.share:=legacy.share; r.votes:=NULL; r.preliminary:=false;
    r.data_release:='workbook-original-1952-58b24038341d;
    r.notes:='Arbeitsmappe SHA-256 58b24038341dce23fa93fdd0e34b6f7742228e846fb82fe562ba6c37f219a93b; Wahlkreise gesamt 1952–2026, Zeile '||legacy.source_row||'; '||legacy.source_url||'; explizite Originalmandats-ID, keine Geometriezuordnung. Originalquelle nicht unabhängig geprüft.';
   END IF;
  END IF;
  IF r.year IS NULL OR (r.votes IS NULL AND r.share IS NULL) THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'candidate:'||c.id,'Passendes Wahlkreisergebnis fehlt',NULL)
    ON CONFLICT DO NOTHING; CONTINUE;
  END IF;
  IF coalesce(r.notes,'') ILIKE '%Zuschnitt 2011%' THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'candidate:'||c.id,'Ergebnis verwendet abweichenden Wahlkreiszuschnitt',r.notes)
    ON CONFLICT DO NOTHING; CONTINUE;
  END IF;
  IF (c.votes IS NOT NULL AND r.votes IS NOT NULL AND c.votes<>r.votes
      AND c.votes IS DISTINCT FROM (c.result_snapshot->>'votes')::bigint)
    OR (c.vote_share IS NOT NULL AND r.share IS NOT NULL AND abs(c.vote_share-r.share)>0.00001
      AND c.vote_share IS DISTINCT FROM (c.result_snapshot->>'share')::numeric) THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'candidate:'||c.id,'Abweichendes vorhandenes persönliches Ergebnis',
    jsonb_build_object('personal_votes',c.votes,'district_votes',r.votes,'personal_share',c.vote_share,'district_share',r.share)::text)
    ON CONFLICT DO NOTHING; CONTINUE;
  END IF;
  IF c.source_url IS NULL AND substring(r.notes from 'https?://[^[:space:];]+') IS NOT NULL THEN
   UPDATE public.election_history_candidacies SET source_url=substring(r.notes from 'https?://[^[:space:];]+') WHERE id=c.id;
  END IF;
  next_votes:=c.votes; next_share:=c.vote_share; next_snapshot:=coalesce(c.result_snapshot,'{}'::jsonb);
  IF r.votes IS NOT NULL AND (c.votes IS NULL OR c.votes=(c.result_snapshot->>'votes')::bigint) THEN
   next_votes:=r.votes; next_snapshot:=next_snapshot||jsonb_build_object('votes',r.votes);
  END IF;
  IF r.share IS NOT NULL AND (c.vote_share IS NULL OR c.vote_share=(c.result_snapshot->>'share')::numeric) THEN
   next_share:=r.share; next_snapshot:=next_snapshot||jsonb_build_object('share',r.share);
  END IF;
  IF next_snapshot<>'{}'::jsonb AND (next_votes IS DISTINCT FROM c.votes OR next_share IS DISTINCT FROM c.vote_share
    OR c.result_preliminary IS DISTINCT FROM r.preliminary OR c.result_data_release IS DISTINCT FROM r.data_release
    OR c.result_notes IS DISTINCT FROM r.notes OR c.result_snapshot IS DISTINCT FROM next_snapshot) THEN
   UPDATE public.election_history_candidacies SET votes=next_votes,vote_share=next_share,
    result_origin='district_result',result_preliminary=r.preliminary,result_data_release=r.data_release,
    result_notes=r.notes,result_snapshot=next_snapshot WHERE id=c.id;
  END IF;
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.election_history_assembly_issues VALUES($1,'candidate:'||c.id,'Ergebnisübernahme durch Validierung geschützt',SQLERRM)
    ON CONFLICT(period_id,record_key) DO UPDATE SET reason=excluded.reason,details=excluded.details;
  END;
 END LOOP;
 PERFORM set_config('app.assembling_election_history',previous_flag,true);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.assembling_election_history',previous_flag,true); RAISE;
END $assemble$;
REVOKE ALL ON FUNCTION public.assemble_election_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assemble_election_history(uuid) TO authenticated;

-- Read-only status for the selected administration period; no confirmation flow.
CREATE OR REPLACE FUNCTION public.get_election_history_assembly_status(selected_period uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $status$
 SELECT jsonb_build_object(
  'automatic_results',(SELECT count(*) FROM public.election_history_candidacies WHERE period_id=$1 AND result_origin='district_result'),
  'linked_mandates',(SELECT count(*) FROM public.election_history_mandates WHERE period_id=$1 AND candidacy_id IS NOT NULL),
  'issue_count',(SELECT count(*) FROM public.election_history_assembly_issues WHERE period_id=$1),
  'issues',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM (
   SELECT issue.record_key,issue.reason,issue.details,coalesce(m.person_name,p.name) AS person_name,d.name AS district_name
   FROM public.election_history_assembly_issues issue
   LEFT JOIN public.election_history_mandates m ON issue.record_key='mandate:'||m.id
   LEFT JOIN public.election_history_candidacies c ON issue.record_key='candidate:'||c.id
   LEFT JOIN public.election_history_people p ON p.id=coalesce(c.person_id,m.person_id)
   LEFT JOIN public.election_history_districts d ON d.id=coalesce(c.district_id,m.district_id)
   WHERE issue.period_id=$1 ORDER BY issue.record_key LIMIT 200) i),'[]'::jsonb)
 ) WHERE public.is_superadmin(auth.uid());
$status$;
REVOKE ALL ON FUNCTION public.get_election_history_assembly_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_history_assembly_status(uuid) TO authenticated;

-- Transition tables synchronize once per affected period, not once per result row.
CREATE OR REPLACE FUNCTION public.sync_assembled_election_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $sync$
DECLARE selected uuid; query text; reference_table text;
BEGIN
 IF coalesce(current_setting('app.assembling_election_history',true),'')='on' THEN RETURN NULL; END IF;
 reference_table:=CASE WHEN TG_OP='DELETE' THEN 'assembly_old' ELSE 'assembly_new' END;
 IF TG_TABLE_NAME IN ('election_history_mandates','election_history_candidacies','election_history_districts') THEN
  query:=format('SELECT DISTINCT period_id FROM %I',reference_table);
 ELSIF TG_TABLE_NAME='election_history_1952_result_sources' THEN
  query:=format('SELECT DISTINCT m.period_id FROM %I n JOIN public.election_history_mandates m ON m.id=n.source_mandate_id',reference_table);
 ELSIF TG_TABLE_NAME='election_history_periods' THEN
  query:=format('SELECT DISTINCT id FROM %I',reference_table);
 ELSE
  query:=format('SELECT DISTINCT y.period_id FROM %I n JOIN public.election_analysis_years y ON y.year=n.year WHERE y.period_id IS NOT NULL',reference_table);
 END IF;
 IF TG_OP='UPDATE' THEN
  query:=query||' UNION '||replace(query,'assembly_new','assembly_old');
 END IF;
 FOR selected IN EXECUTE query LOOP PERFORM public.assemble_election_history(selected); END LOOP;
 RETURN NULL;
END $sync$;
REVOKE ALL ON FUNCTION public.sync_assembled_election_history() FROM PUBLIC;
DO $install$
DECLARE t text; p record;
BEGIN
 FOREACH t IN ARRAY ARRAY['election_history_mandates','election_history_candidacies','election_history_districts','election_history_periods','election_analysis_districts','election_analysis_versions','election_analysis_years','election_history_1952_result_sources'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS z_assemble_history_insert ON public.%I',t);
  EXECUTE format('DROP TRIGGER IF EXISTS z_assemble_history_update ON public.%I',t);
  EXECUTE format('CREATE TRIGGER z_assemble_history_insert AFTER INSERT ON public.%I REFERENCING NEW TABLE AS assembly_new FOR EACH STATEMENT EXECUTE FUNCTION public.sync_assembled_election_history()',t);
  EXECUTE format('CREATE TRIGGER z_assemble_history_update AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS assembly_old NEW TABLE AS assembly_new FOR EACH STATEMENT EXECUTE FUNCTION public.sync_assembled_election_history()',t);
  -- Do not recreate deliberately deleted candidacies or mandates automatically.
 END LOOP;
 FOR p IN SELECT id FROM public.election_history_periods ORDER BY number LOOP
  PERFORM public.assemble_election_history(p.id);
 END LOOP;
END $install$;
COMMIT;
