import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteColorChoices } from './NoteColorChoices';

vi.mock('@/hooks/useUserPreference', () => ({ useUserPreference: () => [[], vi.fn()] }));

describe('shared note color choices', () => {
  it('uses exactly the supplied palette with meanings, names and selected color', () => {
    const select = vi.fn();
    render(<NoteColorChoices palette={[
      { name: 'Blau', value: '#123456', meaning: 'Rückruf' },
      { name: 'Grün', value: '#abcdef' },
    ]} selected="#123456" onSelect={select} />);
    const choices = screen.getAllByRole('button');
    expect(choices).toHaveLength(2);
    expect(choices[0]).toHaveTextContent('Rückruf');
    expect(choices[0]).toHaveAttribute('aria-pressed', 'true');
    expect(choices[0]).toHaveStyle({ backgroundColor: '#123456' });
    expect(choices[1]).toHaveTextContent('Grün');
    fireEvent.click(choices[1]);
    expect(select).toHaveBeenCalledWith('#abcdef');
  });
});
