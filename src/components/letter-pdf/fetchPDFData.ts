import { supabase } from '@/integrations/supabase/client';
import type { LetterRecord, PDFDataState } from './types';

export async function fetchPDFData(letter: LetterRecord): Promise<PDFDataState> {
  const blockId = letter.information_block_ids?.[0];
  const [template, sender, block, attachments, contact] = await Promise.all([
    letter.template_id
      ? supabase.from('letter_templates').select('*').eq('id', letter.template_id).single()
      : null,
    letter.sender_info_id
      ? supabase.from('sender_information').select('*').eq('id', letter.sender_info_id).single()
      : null,
    blockId ? supabase.from('information_blocks').select('*').eq('id', blockId).single() : null,
    letter.id
      ? supabase.from('letter_attachments').select('*').eq('letter_id', letter.id).order('created_at')
      : null,
    letter.contact_id
      ? supabase.from('contacts')
        .select('id, name, gender, last_name, title, business_street, business_house_number, business_postal_code, business_city, business_country')
        .eq('id', letter.contact_id).single()
      : null,
  ]);

  for (const response of [template, sender, block, attachments, contact]) {
    if (response?.error) throw response.error;
  }

  return {
    template: template?.data ?? null,
    senderInfo: sender?.data ?? null,
    informationBlock: block?.data ?? null,
    attachments: attachments?.data ?? [],
    contact: contact?.data ?? null,
  };
}
