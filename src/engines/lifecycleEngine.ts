// Validates an entity's lifecycle transition against domain-model.md's evidenced
// state machine (frontend-architecture.md §7) rather than allowing any-to-any state change.
export function transition(
  allowedStates: string[][],
  currentState: string,
  toState: string
): { ok: boolean; reason?: string } {
  const legal = allowedStates.some(([from, to]) => from === currentState && to === toState);
  if (!legal) {
    return { ok: false, reason: `Illegal transition: ${currentState} -> ${toState}` };
  }
  return { ok: true };
}
