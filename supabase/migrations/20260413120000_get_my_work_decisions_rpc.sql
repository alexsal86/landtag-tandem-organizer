-- Konsolidiert 5-6 sequenzielle DB-Roundtrips in useMyWorkDecisionsData zu einem einzigen RPC-Call.
-- Gibt alle relevanten Beschlüsse für einen Nutzer zurück (als Teilnehmer, Ersteller oder öffentlich sichtbar)
-- inklusive Anhänge, Teilnehmer, Antworten, Themen und Profile.
-- SECURITY INVOKER: RLS-Richtlinien des authentifizierten Nutzers greifen automatisch.

CREATE OR REPLACE FUNCTION get_my_work_decisions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH relevant_decisions AS (
    -- Als Teilnehmer
    SELECT
      d.id,
      d.title,
      d.description,
      d.response_deadline,
      d.status,
      d.created_at,
      d.created_by,
      d.visible_to_all,
      d.response_options,
      d.priority,
      tdp.id    AS participant_id,
      TRUE      AS is_participant,
      (d.created_by = p_user_id) AS is_creator,
      FALSE     AS is_public
    FROM task_decision_participants tdp
    JOIN task_decisions d ON d.id = tdp.decision_id
    WHERE tdp.user_id = p_user_id
      AND d.status IN ('active', 'open')

    UNION

    -- Als Ersteller (nicht nochmal als Teilnehmer zählen)
    SELECT
      d.id, d.title, d.description, d.response_deadline, d.status,
      d.created_at, d.created_by, d.visible_to_all, d.response_options, d.priority,
      NULL::UUID AS participant_id,
      FALSE      AS is_participant,
      TRUE       AS is_creator,
      FALSE      AS is_public
    FROM task_decisions d
    WHERE d.created_by = p_user_id
      AND d.status IN ('active', 'open')

    UNION

    -- Öffentlich sichtbare (visible_to_all), nicht vom Nutzer selbst erstellt
    SELECT
      d.id, d.title, d.description, d.response_deadline, d.status,
      d.created_at, d.created_by, d.visible_to_all, d.response_options, d.priority,
      NULL::UUID AS participant_id,
      FALSE      AS is_participant,
      FALSE      AS is_creator,
      TRUE       AS is_public
    FROM task_decisions d
    WHERE d.visible_to_all = TRUE
      AND d.status IN ('active', 'open')
      AND d.created_by != p_user_id
  ),

  decision_ids AS (
    SELECT DISTINCT id FROM relevant_decisions
  ),

  attachments_agg AS (
    SELECT
      tda.decision_id,
      jsonb_agg(jsonb_build_object(
        'id', tda.id,
        'file_name', tda.file_name,
        'file_path', tda.file_path
      )) AS attachments
    FROM task_decision_attachments tda
    WHERE tda.decision_id IN (SELECT id FROM decision_ids)
    GROUP BY tda.decision_id
  ),

  responses_agg AS (
    SELECT
      tdr.participant_id,
      jsonb_agg(jsonb_build_object(
        'id', tdr.id,
        'response_type', tdr.response_type,
        'comment', tdr.comment,
        'creator_response', tdr.creator_response,
        'parent_response_id', tdr.parent_response_id,
        'created_at', tdr.created_at,
        'updated_at', tdr.updated_at
      ) ORDER BY tdr.created_at) AS responses
    FROM task_decision_responses tdr
    WHERE tdr.participant_id IN (
      SELECT id FROM task_decision_participants WHERE decision_id IN (SELECT id FROM decision_ids)
    )
    GROUP BY tdr.participant_id
  ),

  participants_agg AS (
    SELECT
      tdp.decision_id,
      jsonb_agg(jsonb_build_object(
        'id', tdp.id,
        'user_id', tdp.user_id,
        'task_decision_responses', COALESCE(ra.responses, '[]'::jsonb)
      )) AS participants
    FROM task_decision_participants tdp
    LEFT JOIN responses_agg ra ON ra.participant_id = tdp.id
    WHERE tdp.decision_id IN (SELECT id FROM decision_ids)
    GROUP BY tdp.decision_id
  ),

  topics_agg AS (
    SELECT decision_id, jsonb_agg(topic_id) AS topics
    FROM task_decision_topics
    WHERE decision_id IN (SELECT id FROM decision_ids)
    GROUP BY decision_id
  ),

  relevant_user_ids AS (
    SELECT DISTINCT tdp.user_id
    FROM task_decision_participants tdp
    WHERE tdp.decision_id IN (SELECT id FROM decision_ids)
    UNION
    SELECT DISTINCT created_by FROM relevant_decisions
  ),

  profiles_agg AS (
    SELECT p.user_id, p.display_name, p.badge_color, p.avatar_url
    FROM profiles p
    WHERE p.user_id IN (SELECT user_id FROM relevant_user_ids)
  )

  SELECT jsonb_build_object(
    'decisions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                rd.id,
        'title',             rd.title,
        'description',       rd.description,
        'response_deadline', rd.response_deadline,
        'status',            rd.status,
        'created_at',        rd.created_at,
        'created_by',        rd.created_by,
        'visible_to_all',    rd.visible_to_all,
        'response_options',  rd.response_options,
        'priority',          rd.priority,
        'participant_id',    rd.participant_id,
        'is_participant',    rd.is_participant,
        'is_creator',        rd.is_creator,
        'is_public',         rd.is_public,
        'task_decision_attachments',  COALESCE(aa.attachments, '[]'::jsonb),
        'task_decision_participants', COALESCE(pa.participants, '[]'::jsonb),
        'topic_ids',                  COALESCE(ta.topics, '[]'::jsonb)
      ))
      FROM relevant_decisions rd
      LEFT JOIN attachments_agg  aa ON aa.decision_id = rd.id
      LEFT JOIN participants_agg pa ON pa.decision_id = rd.id
      LEFT JOIN topics_agg       ta ON ta.decision_id = rd.id
    ), '[]'::jsonb),
    'profiles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',      pa.user_id,
        'display_name', pa.display_name,
        'badge_color',  pa.badge_color,
        'avatar_url',   pa.avatar_url
      ))
      FROM profiles_agg pa
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{"decisions": [], "profiles": []}'::jsonb);
END;
$$;
