import { describe, expect, it } from 'vitest';
import { berlinDay, berlinWeek, isValidWeeklyAnswer, pickNextQuestion, upcomingTeamEvents, type TeamProfile } from './logic';
const profile: TeamProfile = { user_id: 'a', display_name: 'Team', opted_in: true, show_events: true, birthday: '02-29', birth_year: null, joined_on: null };
describe('Team-Rituale', () => {
  it('accepts optional answers only with 1–280 Unicode characters', () => {
    expect(isValidWeeklyAnswer('   ')).toBe(false);
    expect(isValidWeeklyAnswer('😀'.repeat(280))).toBe(true);
    expect(isValidWeeklyAnswer('a'.repeat(281))).toBe(false);
  });
  it('rotates through the whole bank before repeating and includes new questions', () => {
    const bank = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickNextQuestion([], [])).toBeNull();
    expect(pickNextQuestion(bank, ['a', 'b'])?.id).toBe('c');
    expect(pickNextQuestion(bank, ['a', 'b', 'c', 'a'])?.id).toBe('b');
    expect(pickNextQuestion([...bank, { id: 'd' }], ['a', 'b', 'c'])?.id).toBe('d');
  });
  it('uses Berlin Mondays, including DST and UTC Sunday night', () => {
    expect(berlinDay(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
    expect(berlinWeek(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
    expect(berlinWeek(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
  });
  it('handles leap days, optional years, consent and cross-year weeks', () => {
    expect(upcomingTeamEvents([profile], new Date('2025-02-28T10:00Z'))[0]).toMatchObject({ date: '2025-02-28', years: null });
    expect(upcomingTeamEvents([profile], new Date('2024-02-29T10:00Z'))[0].date).toBe('2024-02-29');
    expect(upcomingTeamEvents([{ ...profile, show_events: false }, { ...profile, opted_in: false }], new Date('2025-02-28T10:00Z'))).toEqual([]);
    expect(upcomingTeamEvents([{ ...profile, birthday: '01-01', joined_on: '2020-12-31' }], new Date('2025-12-31T10:00Z')).map(e => [e.date, e.years])).toEqual([['2025-12-31', 5], ['2026-01-01', null]]);
    expect(upcomingTeamEvents([{ ...profile, birthday: null, joined_on: '2025-02-28' }], new Date('2025-02-28T10:00Z'))).toEqual([]);
  });
});
