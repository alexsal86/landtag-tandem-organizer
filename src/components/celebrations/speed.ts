export const getCelebrationDuration = (speed: 'slow' | 'normal' | 'fast'): number => {
  switch (speed) {
    case 'slow':
      return 5000;
    case 'fast':
      return 2600;
    default:
      return 3600;
  }
};
