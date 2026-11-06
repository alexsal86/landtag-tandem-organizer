import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SimpleRichTextEditor from './SimpleRichTextEditor';

vi.mock('@/components/plugins/MentionsPlugin', () => ({ MentionsPlugin: () => null }));

function Capture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("<p>Titel</p>");
  const [body, setBody] = useState("");
  return open ? <>
    <SimpleRichTextEditor initialContent={title} onChange={setTitle} showToolbar={false} />
    <div data-testid="body"><SimpleRichTextEditor initialContent={body} autoFocus onChange={setBody} showToolbar={false} /></div>
  </> : <button onClick={() => setOpen(true)}>Notiz erfassen</button>;
}

describe('capture editor focus', () => {
  it('focuses the real Lexical content editor after opening beside a title editor', async () => {
    render(<Capture />);
    fireEvent.click(screen.getByRole('button', { name: 'Notiz erfassen' }));
    const content = screen.getByTestId('body').querySelector('[contenteditable="true"]');
    await waitFor(() => expect(content).toHaveFocus());
  });
});
