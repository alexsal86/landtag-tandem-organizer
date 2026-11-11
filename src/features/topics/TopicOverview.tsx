import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTopics } from "@/hooks/useTopics";
import { useTenant } from "@/hooks/useTenant";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { EmptyState, LoadingState, SectionHeader } from "@/components/ui-patterns";
import { Card } from "@/components/ui/card";
import { Briefcase, Calendar, CheckSquare, FileText, Lightbulb, Users } from "lucide-react";

type Item = { id: string; label: string; meta?: string; href: string };
type Group = { key: string; title: string; icon: typeof Briefcase; items: Item[] };

const ids = (rows: Record<string, unknown>[] | null, col: string) =>
  (rows ?? []).map((r) => r[col]).filter((v): v is string => typeof v === "string");

async function loadGroups(topicId: string, topicLabel: string, tenantId: string): Promise<Group[]> {
  const [cf, ct, dt, at, tt] = await Promise.all([
    supabase.from("case_file_topics").select("case_file_id").eq("topic_id", topicId),
    supabase.from("contact_topics").select("contact_id").eq("topic_id", topicId),
    supabase.from("document_topics").select("document_id").eq("topic_id", topicId),
    supabase.from("appointment_topics").select("appointment_id").eq("topic_id", topicId),
    supabase.from("task_topics").select("task_id").eq("topic_id", topicId),
  ]);
  const cfIds = ids(cf.data, "case_file_id");
  const ctIds = ids(ct.data, "contact_id");
  const dtIds = ids(dt.data, "document_id");
  const atIds = ids(at.data, "appointment_id");
  const ttIds = ids(tt.data, "task_id");

  const tag = await supabase.from("knowledge_tags").select("id").eq("tenant_id", tenantId).ilike("name", topicLabel);
  const tagIds = ids(tag.data, "id");
  const qt = tagIds.length
    ? await supabase.from("knowledge_question_tags").select("question_id").in("tag_id", tagIds)
    : { data: [] };
  const qIds = ids(qt.data, "question_id");

  const none = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [files, contacts, docs, appts, tasks, questions] = await Promise.all([
    cfIds.length ? supabase.from("case_files").select("id,title,status").in("id", cfIds).limit(50) : none,
    ctIds.length ? supabase.from("contacts").select("id,name,organization").in("id", ctIds).limit(50) : none,
    dtIds.length ? supabase.from("documents").select("id,title,category").in("id", dtIds).limit(50) : none,
    atIds.length ? supabase.from("appointments").select("id,title,start_time").in("id", atIds).order("start_time", { ascending: false }).limit(50) : none,
    ttIds.length ? supabase.from("tasks").select("id,title,status").in("id", ttIds).limit(50) : none,
    qIds.length ? supabase.from("knowledge_questions").select("id,title").in("id", qIds).is("archived_at", null).limit(50) : none,
  ]);
  const rows = (r: { data: unknown }) => (Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : []);
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const date = (v: unknown) => (typeof v === "string" ? new Date(v).toLocaleDateString("de-DE") : "");

  return [
    { key: "files", title: "Fallakten", icon: Briefcase, items: rows(files).map((r) => ({ id: s(r.id), label: s(r.title), meta: s(r.status), href: `/casefiles?caseFileId=${s(r.id)}` })) },
    { key: "docs", title: "Dokumente", icon: FileText, items: rows(docs).map((r) => ({ id: s(r.id), label: s(r.title), meta: s(r.category), href: `/documents?highlight=${s(r.id)}` })) },
    { key: "knowledge", title: "Wissensfragen", icon: Lightbulb, items: rows(questions).map((r) => ({ id: s(r.id), label: s(r.title), href: `/wissen?frage=${s(r.id)}` })) },
    { key: "contacts", title: "Ansprechpartner", icon: Users, items: rows(contacts).map((r) => ({ id: s(r.id), label: s(r.name), meta: s(r.organization), href: `/contacts/${s(r.id)}` })) },
    { key: "appts", title: "Termine", icon: Calendar, items: rows(appts).map((r) => ({ id: s(r.id), label: s(r.title), meta: date(r.start_time), href: `/calendar?appointment=${s(r.id)}` })) },
    { key: "tasks", title: "Aufgaben", icon: CheckSquare, items: rows(tasks).map((r) => ({ id: s(r.id), label: s(r.title), meta: s(r.status), href: `/tasks?id=${s(r.id)}` })) },
  ];
}

export function TopicOverview() {
  const { subId } = useParams();
  const navigate = useNavigate();
  const { topics, loading } = useTopics();
  const { currentTenant } = useTenant();
  const topic = topics.find((t) => t.id === subId);
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    if (!topic || !currentTenant?.id) return;
    let alive = true;
    setGroups(null);
    void loadGroups(topic.id, topic.label, currentTenant.id).then((g) => alive && setGroups(g));
    return () => { alive = false; };
  }, [topic?.id, topic?.label, currentTenant?.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-lg p-lg">
      <div className="space-y-sm">
        <h1 className="text-h1">Themen</h1>
        <p className="text-body text-muted-foreground">Alles, was im Büro zu einem Thema zusammenhängt.</p>
        <TopicSelector
          selectedTopicIds={topic ? [topic.id] : []}
          onTopicsChange={(next) => {
            const pick = next.find((id) => id !== topic?.id);
            navigate(pick ? `/themen/${pick}` : "/themen");
          }}
          placeholder={topic ? "Anderes Thema wählen" : "Thema wählen"}
        />
      </div>
      {loading ? <LoadingState /> : !topic ? (
        <EmptyState title="Kein Thema gewählt" description="Wähle oben ein Thema, um Fallakten, Dokumente, Wissen, Kontakte, Termine und Aufgaben dazu zu sehen." />
      ) : !groups ? <LoadingState /> : (
        <div className="grid gap-md md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.key} className="p-md">
              <div className="flex items-center gap-xs">
                <g.icon className="h-4 w-4 text-muted-foreground" />
                <SectionHeader title={`${g.title} (${g.items.length})`} />
              </div>
              {g.items.length === 0 ? (
                <p className="text-caption text-muted-foreground">Noch nichts verknüpft.</p>
              ) : (
                <ul className="mt-xs space-y-2xs">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => navigate(i.href)} className="flex w-full items-baseline justify-between gap-sm rounded-sm px-xs py-2xs text-left text-body hover:bg-muted">
                        <span className="truncate">{i.label || "Ohne Titel"}</span>
                        {i.meta && <span className="shrink-0 text-caption text-muted-foreground">{i.meta}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
