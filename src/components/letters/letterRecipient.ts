export interface EditableAttachment {
  id: string;
  file_name?: string;
  display_name?: string;
}

/**
 * Display-only dedupe for the inline recipient block, mirroring the DIN layout:
 * when the stored address starts with the recipient name, that line is hidden.
 * `hiddenPrefix` lets an edit write the original leading lines back unchanged.
 */
export const dedupeRecipientAddress = (
  name: string | undefined,
  address: string | undefined,
): { display: string; hiddenPrefix: string } => {
  const raw = (address ?? '').replace(/\r\n?/g, '\n');
  const trimmedName = (name ?? '').trim();
  if (!raw || !trimmedName) return { display: raw, hiddenPrefix: '' };

  const lines = raw.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');
  if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== trimmedName) {
    return { display: raw, hiddenPrefix: '' };
  }

  let restIndex = firstContentIndex + 1;
  while (restIndex < lines.length && lines[restIndex].trim() === '') restIndex += 1;

  return {
    display: lines.slice(restIndex).join('\n'),
    hiddenPrefix: `${lines.slice(0, restIndex).join('\n')}\n`,
  };
};

export const isEditableAttachment = (value: unknown): value is EditableAttachment => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string';
};
