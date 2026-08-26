/** Pending payment-request id when the app opens a link before auth is ready. */

let pendingPreparationId: string | null = null;

export function setPendingPaymentLink(preparationId: string) {
  pendingPreparationId = preparationId;
}

export function takePendingPaymentLink(): string | null {
  const id = pendingPreparationId;
  pendingPreparationId = null;
  return id;
}

export function peekPendingPaymentLink(): string | null {
  return pendingPreparationId;
}

export function clearPendingPaymentLink() {
  pendingPreparationId = null;
}
