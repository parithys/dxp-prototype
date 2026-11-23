// A journey that hands the agent to another screen can say where "back" goes: the page it came from, by name, and the customer it had identified so that
// page opens for them again. It travels in the router state (`returnTo`); the screen it opens shows a floating Back bar for it.
export interface ReturnTo {
  path: string;
  label: string;
  /** The customer the origin had identified (router state `launch` of the page it returns to). */
  launch?: { customerId: string };
}

/** The `returnTo` a navigation carried, or undefined when there is none or it is not a same-app path. */
export function returnToOf(state: unknown): ReturnTo | undefined {
  const r = (state as { returnTo?: Partial<ReturnTo> } | null | undefined)?.returnTo;
  return r && typeof r.path === 'string' && r.path.startsWith('/') && typeof r.label === 'string' ? (r as ReturnTo) : undefined;
}
