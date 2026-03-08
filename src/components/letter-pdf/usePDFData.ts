import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Letter, LetterTemplate } from './types';

export function usePDFData(letter: Letter) {
  const [template, setTemplate] = useState<LetterTemplate | null>(null);
  const [senderInfo, setSenderInfo] = useState<any>(null);
  const [informationBlock, setInformationBlock] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (letter.template_id) {
          const { data, error } = await supabase
            .from('letter_templates')
            .select('*')
            .eq('id', letter.template_id)
            .single();
          if (error) throw error;
          setTemplate(data);
        } else {
          setTemplate(null);
        }

        if (letter.sender_info_id) {
          const { data, error } = await supabase
            .from('sender_information')
            .select('*')
            .eq('id', letter.sender_info_id)
            .single();
          if (error) throw error;
          setSenderInfo(data);
        } else {
          setSenderInfo(null);
        }

        if (letter.information_block_ids && letter.information_block_ids.length > 0) {
          const { data, error } = await supabase
            .from('information_blocks')
            .select('*')
            .eq('id', letter.information_block_ids[0])
            .single();
          if (error) throw error;
          setInformationBlock(data);
        } else {
          setInformationBlock(null);
        }

        if (letter.id) {
          const { data, error } = await supabase
            .from('letter_attachments')
            .select('*')
            .eq('letter_id', letter.id)
            .order('created_at');
          if (error) throw error;
          setAttachments(data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [letter.template_id, letter.sender_info_id, letter.information_block_ids, letter.id]);

  return { template, senderInfo, informationBlock, attachments };
}
