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
