import { useEffect, useRef, useState } from 'react';
import { useLocation } from '../../lib/router';
import { CustomerSearchResults, MIN_QUERY_LENGTH } from './CustomerSearchResults';
import { useCustomerSearch } from './useCustomerSearch';
import { SearchField, Button, Icon, SEARCH_LARGE } from 'dxp-ui';
import { PageHeader } from '../../components/patterns/PageHeader';



// The new primary entry point (replaces browsing a module to find a
// customer-adjacent screen): one box, matched-field badges so an agent can
// see *why* a result surfaced. 2026-10-01: searches on Enter, and only once
// at least MIN_QUERY_LENGTH characters have been typed - it used to search
// as you typed (debounced), which fired on one- and two-character fragments.

export function CustomerSearchPage() {
  // The Dashboard search hands its text over here, so it opens already searched.
  const location = useLocation();
  const locationState = location.state as { query?: string; newTicket?: boolean; focusSearch?: boolean } | null;
  const inputRef = useRef<HTMLInputElement>(null);
  // The search box takes focus whenever the page opens, and again each time the Universal Search button is pressed on this page
  // (a new location key; the button also hands over focusSearch).
  useEffect(() => {
    inputRef.current?.focus();
  }, [location.key, locationState?.focusSearch]);
  const handedOver = locationState?.query ?? '';
  // Arrived from a "New Ticket" button: the customer opened next starts on the "How can we help today?" search.
  const newTicket = Boolean(locationState?.newTicket);
  const [query, setQuery] = useState(handedOver);
  // The query the results on screen belong to - set only by pressing Enter.
  const [submitted, setSubmitted] = useState(handedOver.length >= MIN_QUERY_LENGTH ? handedOver : '');
  const { results, businesses, searching } = useCustomerSearch(submitted);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  // Results are stale the moment the text no longer matches what was searched.
  const showingResults = submitted !== '' && trimmed === submitted;

  const runSearch = () => {
    // Nothing runs for empty / too-short text, or while a search is already in flight (repeat clicks and
    // Enter presses are ignored until it finishes).
    if (!canSearch || searching) return;
    setSubmitted(trimmed);
  };

  return (
    <div className="p-8 w-full">
      <PageHeader title={<>Customer Search</>} description={<>Look up a customer by mobile number, QID, customer number, account number, name, email, or service ID.</>} />

      {/* Field and Search button on one row (the field shrinks, the button keeps its width); Enter in the
          field and the button run the same search. The text stays in the field after a search. */}
      <form
        role="search"
        aria-label="Customer search"
        className="row items-stretch mb-2 search-form-lg"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="relative flex-1 min-w-0">
        <SearchField
          ref={inputRef}
          aria-label="Customer search query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Search a customer by mobile, QID, account number…"
          onClear={() => {
            setQuery('');
            setSubmitted('');
          }}
        />
        </div>
        <Button type="submit" disabled={!canSearch || searching} aria-busy={searching} aria-label={searching ? 'Searching' : 'Search'} className="search-submit">
          {searching ? (
            <span aria-hidden="true" className=" spinner-ring" />
          ) : (
            <Icon path={SEARCH_LARGE} className="size-7 " />
          )}
        </Button>
      </form>

      {!showingResults && (
        <p className="caption-muted mt-3">
          {canSearch
            ? 'Press Enter or Search to search.'
            : `Enter at least ${MIN_QUERY_LENGTH} characters, then press Enter or Search to see results.`}
        </p>
      )}

      {showingResults && (
        <div className="mt-4">
          <CustomerSearchResults submitted={submitted} results={results} businesses={businesses} searching={searching} newTicket={newTicket} />
        </div>
      )}
    </div>
  );
}
