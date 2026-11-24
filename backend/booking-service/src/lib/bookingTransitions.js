export const bookingTransitions = Object.freeze({
  requested: ['awaiting_payment', 'rejected', 'cancelled', 'confirmed'],
  pending: ['awaiting_payment', 'rejected', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['started', 'cancelled'],
  started: ['completed'],
});

export function canTransition(from, to) {
  return bookingTransitions[from]?.includes(to) ?? false;
}

export function allowedPreviousStatuses(to) {
  return Object.entries(bookingTransitions).filter(([, targets]) => targets.includes(to)).map(([status]) => status);
}
