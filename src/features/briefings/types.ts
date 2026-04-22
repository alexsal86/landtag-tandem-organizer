export interface DailyBriefing {
  id: string;
  tenant_id: string;
  author_id: string;
  briefing_date: string; // YYYY-MM-DD
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DailyBriefingWithAuthor extends DailyBriefing {
  author_display_name: string | null;
  author_avatar_url: string | null;
  is_read: boolean;
}
