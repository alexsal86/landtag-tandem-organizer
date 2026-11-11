import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { KnowledgePerson } from "../types";
import {
  knowledgePersonColor,
  knowledgePersonInitials,
  knowledgePersonLabel,
} from "../person";

// Decorative: callers always render the person's name beside this avatar.
export function KnowledgePersonAvatar({
  person,
}: {
  person: KnowledgePerson | null;
}) {
  const label = knowledgePersonLabel(person);
  const root = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!root.current || !person?.avatar_url) return;
    // Radix preloads images internally, so loading="lazy" alone does not defer
    // its request. Mount AvatarImage only near the visible scroll area.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "96px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [person?.avatar_url]);
  return (
    <Avatar
      ref={root}
      className={`h-6 w-6 shrink-0 text-[10px] ${person ? "" : "border border-dashed border-muted-foreground"}`}
      aria-hidden="true"
      title={label}
      aria-label={person ? undefined : "Nicht zugeordnet"}
    >
      {visible && person?.avatar_url && (
        <AvatarImage src={person.avatar_url} loading="lazy" alt="" />
      )}
      <AvatarFallback
        className={
          person
            ? "font-semibold text-slate-900"
            : "bg-transparent text-muted-foreground"
        }
        style={
          person
            ? { backgroundColor: knowledgePersonColor(person.user_id) }
            : undefined
        }
      >
        {person ? knowledgePersonInitials(person.display_name) : "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function KnowledgePersonLabel({
  person,
  showAvatar = true,
}: {
  person: KnowledgePerson | null;
  showAvatar?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 align-middle">
      {showAvatar && <KnowledgePersonAvatar person={person} />}
      <span className="min-w-0 break-words">
        {knowledgePersonLabel(person)}
      </span>
    </span>
  );
}
