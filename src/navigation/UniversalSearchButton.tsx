import { useEffect } from 'react';
import { Button, Icon, Tooltip, SEARCH_LARGE } from 'dxp-ui';
import { useUniversalSearch } from './useUniversalSearch';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The Universal Search button, at the right end of the breadcrumb row (it replaced the "Customer Search" item in the left navigation).
 * It opens /customer-search with the search box focused, and is offered only to roles that may use the Customer Search workspace.
 * The Dashboard has its own customer search box, so the breadcrumb row (and this button) is not drawn there.
 */
export function UniversalSearchButton() {
  const { allowed, open } = useUniversalSearch();
  if (!allowed) return null;
  return (
    <Tooltip content={`Universal Search (${isMac() ? '⌘' : 'Ctrl'} + /)`} placement="bottom">
      <Button type="button" size="icon" aria-label="Universal Search" aria-keyshortcuts="Control+/ Meta+/" className="universal-search-btn" onClick={open}>
        <Icon path={SEARCH_LARGE} className="size-4" />
      </Button>
    </Tooltip>
  );
}

/** Cmd + / (Ctrl + / off a Mac) opens Universal Search from any page, including from inside a field. Mounted once, by the shell. */
export function UniversalSearchShortcut() {
  const { allowed, open } = useUniversalSearch();
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed, open]);
  return null;
}
