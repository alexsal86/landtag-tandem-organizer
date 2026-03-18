ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS content_goal text,
  ADD COLUMN IF NOT EXISTS format_variant text,
  ADD COLUMN IF NOT EXISTS asset_requirements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS publish_link text,
  ADD COLUMN IF NOT EXISTS performance_notes text;
