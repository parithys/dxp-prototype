/**
 * Whether this window is the customer's pop-up ("Customer view", ?mirror=1) rather than the agent's screen. Read once from the address, as the journey's own session
 * hook does. The customer's language choice on the signing screen exists only here; the agent's screen stays in English.
 */
export function useCustomerPopup(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mirror') === '1';
}
