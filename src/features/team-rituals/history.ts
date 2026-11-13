/** Used questions remain active for repetition; only explicitly paused questions are archived. */
export function partitionQuestions<T extends { active: boolean }>(questions: readonly T[]): { active: T[]; archived: T[] } {
  return { active: questions.filter(question => question.active), archived: questions.filter(question => !question.active) };
}
export function ritualMonth(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}
