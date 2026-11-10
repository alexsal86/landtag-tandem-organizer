import type { Database, Json } from '@/integrations/supabase/types';

export type KnowledgeQuestion = Database['public']['Tables']['knowledge_questions']['Row'];
export type KnowledgeCard = Database['public']['Views']['knowledge_question_cards']['Row'];
export type KnowledgeAttachment = Database['public']['Tables']['knowledge_question_attachments']['Row'];
export type KnowledgeEvent = Database['public']['Tables']['knowledge_question_events']['Row'];
export type KnowledgeView = 'answers' | 'open' | 'mine';
export type ReviewStatus = 'unverified' | 'verified' | 'needs_review';
export interface AnswerDraft { plainText: string; nodesJson?: string; html?: string }
export interface KnowledgeNode { type: string; text?: string; url?: string; children?: KnowledgeNode[]; [key: string]: Json | KnowledgeNode[] | undefined }
