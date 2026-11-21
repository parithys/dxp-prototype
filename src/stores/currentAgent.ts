import { store } from './store';

/** The signed-in agent's user id, for stamping the records they create (never a hard-coded demo agent). */
export const currentAgentId = (): string => store.getState().auth.profile?.userId ?? 'unknown-agent';
