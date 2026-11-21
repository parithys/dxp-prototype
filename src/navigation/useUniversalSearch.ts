import { useCallback } from 'react';
import { useNavigate } from '../lib/router';
import { canUseFeature } from '../engines/personaEngine';
import { useAppSelector } from '../stores/hooks';

const SEARCH_PATH = '/customer-search';

/**
 * Opening Universal Search = opening Customer Search with its box focused, for roles that may use it. It pushes a history entry, so Back
 * returns to the page the user was on; opened again while already on Customer Search it replaces that entry instead, so Back still goes to
 * the page before it rather than to a second copy of Customer Search.
 */
export function useUniversalSearch() {
  const navigate = useNavigate();
  const activePersonaId = useAppSelector((s) => s.persona.activePersonaId);
  const allowed = canUseFeature(activePersonaId, 'workspace.customer-search');
  const open = useCallback(() => {
    navigate(SEARCH_PATH, { state: { focusSearch: true }, replace: window.location.pathname === SEARCH_PATH });
  }, [navigate]);
  return { allowed, open };
}
