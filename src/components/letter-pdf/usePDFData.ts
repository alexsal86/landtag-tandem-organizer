import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LetterRecord, LetterTemplate, PDFDataState, DbContact } from './types';
import { debugConsole } from '@/utils/debugConsole';

export function usePDFData(letter: LetterRecord): PDFDataState {
  const [template, setTemplate] = useState<LetterTemplate | null>(null);
  const [senderInfo, setSenderInfo] = useState<PDFDataState['senderInfo']>(null);
  const [informationBlock, setInformationBlock] = useState<PDFDataState['informationBlock']>(null);
  const [attachments, setAttachments] = useState<PDFDataState['attachments']>([]);
  const [contact, setContact] = useState<DbContact | null>(null);

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
          setAttachments(data ?? []);
        }

        // Fetch contact for recipient variable data
        if (letter.contact_id) {
          const { data, error } = await supabase
            .from('contacts')
            .select('id, name, gender, last_name, title, private_street, private_house_number, private_postal_code, private_city, private_country, business_street, business_house_number, business_postal_code, business_city, business_country')
            .eq('id', letter.contact_id)
            .single();
          if (error) throw error;
          setContact(data);
        } else {
          setContact(null);
        }
      } catch (error) {
        debugConsole.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [letter.template_id, letter.sender_info_id, letter.information_block_ids, letter.id, letter.contact_id]);

  return { template, senderInfo, informationBlock, attachments, contact };
}
