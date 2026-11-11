import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { knowledgeKey, useKnowledgeScope } from "./useKnowledgeQuestions";
import type {
  KnowledgeTag,
  KnowledgeSource,
  KnowledgeSourceKind,
  KnowledgeComment,
} from "../types";

export function useKnowledgeTags() {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), "tags"],
    enabled: Boolean(userId && tenantId),
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("knowledge_tags")
        .select("id,name")
        .eq("tenant_id", tenantId!)
        .order("name")
        .limit(500)
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      return data as KnowledgeTag[];
    },
  });
}
export type KnowledgeExtraRequest =
  | {
      name: "knowledge_qa_set_tags";
      args: {
        p_question: string;
        p_expected_revision: number;
        p_names: string[];
      };
    }
  | {
      name: "knowledge_qa_manage_tag";
      args: { p_tag: string; p_name?: string; p_merge_into?: string };
    }
  | {
      name: "knowledge_qa_add_source";
      args: {
        p_question: string;
        p_expected_revision: number;
        p_kind: KnowledgeSourceKind;
        p_title?: string;
        p_url?: string;
        p_document?: string;
        p_case?: string;
        p_as_of?: string;
      };
    }
  | {
      name: "knowledge_qa_remove_source";
      args: { p_source: string; p_expected_revision: number };
    }
  | {
      name: "knowledge_qa_comment" | "knowledge_qa_report_outdated";
      args: { p_question: string; p_expected_revision: number; p_body: string };
    }
  | {
      name: "knowledge_qa_follow";
      args: { p_question: string; p_follow: boolean };
    };
export function useKnowledgeExtraWrite() {
  const { userId, tenantId } = useKnowledgeScope();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: KnowledgeExtraRequest) => {
      const { error } = await supabase.rpc(request.name, request.args);
      if (error) throw new Error(error.message);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: knowledgeKey(userId, tenantId) }),
  });
}

export function useKnowledgeSources(questionId: string, enabled = true) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), "sources", questionId],
    enabled: Boolean(enabled && userId && tenantId && questionId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("knowledge_question_sources")
        .select(
          "id,question_id,kind,title,url,document_id,case_id,as_of,created_by,created_at",
        )
        .eq("tenant_id", tenantId!)
        .eq("question_id", questionId)
        .order("created_at")
        .order("id")
        .limit(10)
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      return data as KnowledgeSource[];
    },
  });
}
export function useKnowledgeReferencePicker(
  kind: KnowledgeSourceKind,
  search: string,
) {
  const { userId, tenantId } = useKnowledgeScope();
  const [term, setTerm] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  return useQuery({
    queryKey: [
      ...knowledgeKey(userId, tenantId),
      "reference-picker",
      kind,
      term,
    ],
    enabled: Boolean(
      userId && tenantId && (kind === "document" || kind === "case"),
    ),
    queryFn: async ({ signal }) => {
      const literal = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      const { data, error } = await supabase
        .from(kind === "document" ? "documents" : "case_files")
        .select("id,title")
        .eq("tenant_id", tenantId!)
        .ilike("title", `%${literal}%`)
        .order("title")
        .order("id")
        .limit(20)
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useKnowledgeFollow(questionId: string) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), "following", questionId],
    enabled: Boolean(userId && tenantId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("knowledge_question_followers")
        .select("user_id")
        .eq("tenant_id", tenantId!)
        .eq("question_id", questionId)
        .eq("user_id", userId!)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });
}
export function useKnowledgeComments(questionId: string, enabled: boolean) {
  const { userId, tenantId } = useKnowledgeScope();
  return useInfiniteQuery({
    queryKey: [...knowledgeKey(userId, tenantId), "comments", questionId],
    enabled: Boolean(enabled && userId && tenantId),
    initialPageParam: null as number | null,
    getNextPageParam: (last: {
      items: KnowledgeComment[];
      nextCursor: number | null;
    }) => last.nextCursor ?? undefined,
    queryFn: async ({ signal, pageParam }) => {
      let request = supabase
        .from("knowledge_question_comment_cards")
        .select(
          "id,question_id,author_id,body,created_at,revision,author_person",
        )
        .eq("tenant_id", tenantId!)
        .eq("question_id", questionId)
        .order("revision", { ascending: false })
        .limit(21);
      if (pageParam !== null) request = request.lt("revision", pageParam);
      const { data, error } = await request.abortSignal(signal);
      if (error) throw new Error(error.message);
      const items = (data ?? []).slice(0, 20) as unknown as KnowledgeComment[];
      return {
        items,
        nextCursor:
          data && data.length > 20 ? items[items.length - 1].revision : null,
      };
    },
  });
}

export function useKnowledgeTagSuggestions(
  query: string,
  excludedNames: string[],
  enabled: boolean,
) {
  const { userId, tenantId } = useKnowledgeScope();
  const [term, setTerm] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useQuery({
    queryKey: [
      ...knowledgeKey(userId, tenantId),
      "tag-suggestions",
      term,
      excludedNames,
    ],
    enabled: Boolean(enabled && userId && tenantId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("knowledge_qa_tag_suggestions", {
          p_tenant: tenantId!,
          p_query: term,
          p_exclude_names: excludedNames,
        })
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      return {
        items: (data?.[0]?.items ?? []) as unknown as KnowledgeTag[],
        total: data?.[0]?.total_count ?? 0,
        exact: data?.[0]?.exact_match ?? false,
      };
    },
  });
  return {
    ...result,
    data: term === query ? result.data : undefined,
    debouncing: term !== query,
  };
}
