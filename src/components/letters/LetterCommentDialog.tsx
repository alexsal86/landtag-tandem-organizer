import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface LetterCommentDialogProps {
  onSubmit: (content: string) => void;
  onClose: () => void;
}

const LetterCommentDialog: React.FC<LetterCommentDialogProps> = ({ onSubmit, onClose }) => {
  const [text, setText] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Kommentar hinzufügen</h3>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ihr Kommentar..."
          rows={4}
          className="mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => { onSubmit(text); setText(''); }} disabled={!text.trim()}>Hinzufügen</Button>
        </div>
      </div>
    </div>
  );
};

export default LetterCommentDialog;
