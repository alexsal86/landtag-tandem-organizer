import { startOfDay, isBefore, isAfter, addDays } from "date-fns";
import type { QuickNote } from "./types";
import type { GroupedNotes } from "@/hooks/quickNotes/types";
export function groupNotesByPriority(allNotes: QuickNote[]) {
    const now = startOfDay(new Date());

    const followUpNotes = allNotes.filter(n =>
      n.follow_up_date && isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    ).sort((a, b) =>
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );

    const scheduledFollowUps = allNotes.filter(n =>
      n.follow_up_date && isAfter(startOfDay(new Date(n.follow_up_date)), now)
    ).sort((a, b) =>
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );

    const remaining = allNotes.filter(n => !n.follow_up_date);
    const maxLevel = Math.max(...remaining.map(n => n.priority_level || 0), 0);

    const groups: GroupedNotes[] = [];

    for (let level = 1; level <= maxLevel; level++) {
      const levelNotes = remaining.filter(n => n.priority_level === level);
      if (levelNotes.length > 0) {
        groups.push({
          level,
          label: `Level ${level}`,
          notes: levelNotes.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
        });
      }
    }

    const standardNotes = remaining.filter(n => !n.priority_level || n.priority_level === 0);
    if (standardNotes.length > 0) {
      groups.push({
        level: 0,
        label: 'Ohne Priorität',
        notes: standardNotes.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
      });
    }

    return { groups, followUpNotes, scheduledFollowUps };
}
