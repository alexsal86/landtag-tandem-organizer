import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LetterBriefDetails from '../LetterBriefDetails';

const baseProps = {
  setEditedLetter: vi.fn(),
  canEdit: true,
  isReviewer: true,
  userProfiles: {},
  onStatusTransition: vi.fn(),
  broadcastContentChange: vi.fn(),
};

const openReturnDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: /Brief zurückgeben/i }));
  return screen.getByLabelText('Begründung') as HTMLTextAreaElement;
};

describe('LetterBriefDetails: Rückgabedialog', () => {
  it('bleibt bei fehlgeschlagenem Speichern offen und behält die Begründung', async () => {
    const onReturnLetter = vi.fn().mockResolvedValue(false);
    render(
      <LetterBriefDetails
        {...baseProps}
        editedLetter={{ status: 'review', title: 'Brief' }}
        onReturnLetter={onReturnLetter}
      />,
    );

    const field = openReturnDialog();
    fireEvent.change(field, { target: { value: 'Absatz 2 bitte kürzen.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));

    await waitFor(() => expect(onReturnLetter).toHaveBeenCalledTimes(1));
    expect(onReturnLetter).toHaveBeenCalledWith('Absatz 2 bitte kürzen.');

    const preserved = screen.getByLabelText('Begründung') as HTMLTextAreaElement;
    expect(preserved).toBeTruthy();
    expect(preserved.value).toBe('Absatz 2 bitte kürzen.');
  });

  it('schließt den Dialog und leert die Begründung nach erfolgreicher Rückgabe', async () => {
    const onReturnLetter = vi.fn().mockResolvedValue(true);
    render(
      <LetterBriefDetails
        {...baseProps}
        editedLetter={{ status: 'review', title: 'Brief' }}
        onReturnLetter={onReturnLetter}
      />,
    );

    const field = openReturnDialog();
    fireEvent.change(field, { target: { value: 'Bitte kürzen.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));

    await waitFor(() => expect(screen.queryByLabelText('Begründung')).toBeNull());
  });

  it('verlangt eine Begründung, bevor zurückgegeben werden kann', () => {
    const onReturnLetter = vi.fn().mockResolvedValue(true);
    render(
      <LetterBriefDetails
        {...baseProps}
        editedLetter={{ status: 'review', title: 'Brief' }}
        onReturnLetter={onReturnLetter}
      />,
    );

    openReturnDialog();
    const submit = screen.getByRole('button', { name: 'Zurückgeben' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: '   ' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: 'Kürzen.' } });
    expect(submit.disabled).toBe(false);
  });
});
