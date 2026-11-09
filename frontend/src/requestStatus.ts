export type RequestStatusTone = 'open' | 'in-progress' | 'completed' | 'cancelled' | 'unknown';

export function getRequestStatusPresentation(status: string): { label: string; tone: RequestStatusTone } {
  switch (status) {
    case 'NEW':
    case 'WAITING_FOR_OFFERS':
      return { label: 'Otvoren', tone: 'open' };
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      return { label: 'U proceduri', tone: 'in-progress' };
    case 'COMPLETED':
      return { label: 'Završen', tone: 'completed' };
    case 'CANCELLED':
      return { label: 'Otkazan', tone: 'cancelled' };
    default:
      return { label: status.replaceAll('_', ' ') || 'Nepoznat status', tone: 'unknown' };
  }
}

export function getRatingCountLabel(count: number): string {
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'ocena';
  const lastDigit = count % 10;
  if (lastDigit === 1) return 'ocena';
  if (lastDigit >= 2 && lastDigit <= 4) return 'ocene';
  return 'ocena';
}
