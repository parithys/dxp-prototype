// PROTECTED (docs/migration/phase5-specialised-components.md): the only toast renderer (reads the Redux notification slice); do not add a second toast system (Sonner, Radix Toast).
import { Fragment, useEffect, useRef } from 'react';
import { Link } from '../../lib/router';

import { notificationActions, type ToastBrand, type ToastKind, type ToastRow } from '../../stores/notificationSlice';
import { useAction, useAppSelector } from '../../stores/hooks';
import { Icon, VodafoneMark, CLEAR_ICON } from 'dxp-ui';
import { ROW_ICON, type RowTone } from '../../components/domain/eligibilityRowsModel';

// A plain toast speaks the eligibility result cards' language (one hue and one icon per outcome): success is a pass (green tick), an error a hard stop (red cross),
// a warning a soft stop (amber triangle) and information an advisory (blue "i"). The card, its border and its icon tile come from the same `.eligibility-alert-*` classes.
const KIND_OUTCOME: Record<ToastKind, RowTone> = {
  success: 'pass',
  error: 'hard-stop',
  warning: 'soft-stop',
  info: 'advisory',
};

// Value colour per row tone, lifted toward white because the surface is dark
// in BOTH themes: the base tokens are tuned for light backgrounds, and the
// brightened dark-mode values only apply under .dark, which does not help a
// dark toast sitting in the light theme.
//
// 'id' borrows --field-calendar-range, the only cyan already in the palette,
// so a reference number reads as a distinct class of value from a status
// without introducing a new hue. Lifted 45% to land on the mint the reference
// uses rather than the saturated cyan the raw token gives.
// One definition, used by BOTH the 'id' row tone and the headline reference,
// so a reference number looks the same wherever it appears. The ticket id
// moved from a row into the headline on 2026-09-25 and lost this treatment in
// the move; naming it is what stops the two drifting again.
const ID_TONE = 'text-[var(--toast-fg-id)]';

const rowToneClass: Record<NonNullable<ToastRow['tone']>, string> = {
  default: 'text-on-dark',
  id: ID_TONE,
  success: 'text-[var(--toast-fg-success)]',
};

// Maps the store's serialisable ToastBrand to a mark. The store holds
// 'vodafone' | 'other' and a relationship string; deciding what those LOOK
// like is this layer's job, which is why no ReactNode crosses into state.
//
// The Vodafone case shows the mark AND the SEGMENT (Consumer / Business),
// because for an existing customer "which operator" is not the useful half -
// the agent already knows they are at a Vodafone counter. What they need
// before they speak is which kind of customer this is.
//
// Prepaid/Postpaid used to occupy this slot and moved to the Mobile number
// row on 2026-09-25, where it reads as "(Postpaid)" directly under the
// number it describes. Keeping it here as well put the same fact on the card
// twice; and the two are different in kind anyway - a segment describes the
// customer, a relationship describes one line.
//
// The 'other' case shows the mark alone. There is no relationship to state: a
// competitor's customer has no Vodafone prepaid/postpaid standing, and
// printing one would be an invention rather than a blank.
//
// A Vodafone customer with no segment on file ALSO shows the mark alone.
// This slot briefly read "No active lines", which was wrong twice over:
//
// - It answered a question the slot does not ask. The slot is the
//   relationship type for the number Qnomy handed over; how many lines the
//   customer holds is a different fact and now has its own row.
// - It over-claimed. The two source fields count MOBILE lines only, so it
//   announced "No active lines" for a customer whose fixed-line service is
//   active - CUST-1003 holds GigaHome account ACC-5003.
//
// An empty slot is no longer ambiguous now that "Active lines" is a labelled
// row, which is what made the filler look necessary in the first place.
function ToastBrandMark({ brand }: { brand: ToastBrand }) {
  // A competitor's customer shows no mark at all.
  if (brand.operator !== 'vodafone') return null;
  return (
    <span className="row gap-2">
      <VodafoneMark className="icon-sm" />
      {brand.segment && (
        <span className="toast-time">
          {brand.segment}
        </span>
      )}
    </span>
  );
}

const dotColour: Record<ToastKind, string> = {
  success: 'var(--toast-dot-success)',
  error: 'var(--toast-dot-error)',
  warning: 'var(--toast-dot-warning)',
  info: 'var(--toast-dot-info)',
};

// Toast/Alert/ConfirmDialog per notification-catalogue.md section 4's evidenced
// taxonomy. Error toasts use role="alert" (implicitly assertive) so screen
// readers interrupt for failures; success/info/warning use role="status"
// (polite) so they're announced without stealing focus from whatever the user
// was doing.
//
// The card is a dark --charcoal-panel surface in both themes. A toast is
// transient and overlays whatever the agent is reading, so an inverted surface
// separates it from the page without leaning on the elevation the rest of the
// re-skin removed - and it looks the same in dark mode instead of inverting
// along with the page underneath it.
//
// STRUCTURE, for the structured variant. Header band, full-bleed rule, body:
// three stacked blocks, NOT a flex row with the rule nested inside a content
// column. The dot and the title are inside the header's own padding, so the
// rule can span the card edge to edge. Nesting it beside the dot - which is
// what this did first - insets the rule by the dot's width plus its gap, and
// no amount of padding tuning fixes that because the rule is simply in the
// wrong box.
//
// Type carries the hierarchy: the title is caption-sized, uppercase and
// tracked; labels are caption-sized and dimmed; VALUES are body-sized and
// semibold. Rendering labels and values at one size, which this also did
// first, leaves the agent no way to scan values without reading labels too.
export function ToastContainer() {
  const toasts = useAppSelector((s) => s.notification.toasts);
  const dismissToast = useAction(notificationActions.dismissToast);
  const dismissAllToasts = useAction(notificationActions.dismissAllToasts);
  const stackRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere off the stack clears it.
  //
  // Attached on a deferred tick, NOT synchronously: almost every toast in this
  // app is pushed BY a click (Next Customer, Finish, Save), and that same
  // click is still propagating when this effect runs. Listening immediately
  // would let the originating click dismiss the toast it just created, so the
  // notification would never be readable.
  //
  // pointerdown rather than click, so the dismissal happens as the agent
  // starts interacting elsewhere instead of waiting for mouseup, and it still
  // fires for touch.
  //
  // Escape is bound too. Without it this feature would be mouse-only: there is
  // no keyboard equivalent of "click outside", so a keyboard user would be
  // left with only the per-toast dismiss button while everyone else got a
  // one-gesture clear.
  useEffect(() => {
    if (!toasts.length) return;
    let armed = false;
    const arm = setTimeout(() => {
      armed = true;
    }, 0);
    const onPointerDown = (e: PointerEvent) => {
      if (!armed) return;
      if (stackRef.current?.contains(e.target as Node)) return;
      dismissAllToasts();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAllToasts();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toasts.length, dismissAllToasts]);

  if (!toasts.length) return null;
  return (
    // Two stacks: one-line toasts sit directly below the app header (h-16 in PersonaSwitcher) so they never cover its controls; structured cards (ticket assigned etc.) sit at the bottom centre, clear of the page content they annotate. items-center with no fixed stack width, because a
    // structured card needs room for five columns while a one-line card should
    // stay narrow - each card sets its own max-width and they centre
    // independently rather than all stretching to the widest one.
    //
    // pointer-events-none on the stack keeps the wide footprint from
    // swallowing clicks on the page behind it; only the cards take pointer
    // events back.
    <div ref={stackRef}>
      {[
        { key: 'top', list: toasts.filter((t) => !t.rows?.length), pos: 'top-[var(--size-toast-top)]' },
        { key: 'bottom', list: toasts.filter((t) => t.rows?.length), pos: 'bottom-4' },
      ].map(({ key, list, pos }) => (
        <div key={key} className={`fixed ${pos} toast-region`}>
      {list.map((t) => {
        const structured = Boolean(t.rows?.length);
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            className={`toast-card ${
              !structured ? `toast-plain eligibility-alert-${KIND_OUTCOME[t.kind]}` : 'bg-[var(--charcoal-panel)]'
            } ${structured ? 'max-w-[var(--size-toast-max-w-wide)]' : 'max-w-[var(--size-toast-max-w)]'}`}
          >
            {structured ? (
              <>
                <div className="spread items-center px-5 py-3.5">
                  <span className="row min-w-0">
                    <span
                      className="dot-md shrink-0"
                      style={{ backgroundColor: dotColour[t.kind] }}
                      aria-hidden="true"
                    />
                    <span className="toast-title">
                      {t.message}
                      {/* The reference keeps the headline's uppercase and
                          tracking - it inherits them - and changes only
                          colour, so it reads as the same line rather than as
                          a separate chip. */}
                      {t.reference && <span className={`ml-1.5 ${ID_TONE}`}>{t.reference}</span>}
                    </span>
                  </span>
                  {/* Operator mark and the dismiss button share the right end,
                      so the mark lands inside the header row rather than
                      becoming a third justify-between column floating in the
                      middle of it. */}
                  <span className="row gap-4 shrink-0">
                    {t.brand && <ToastBrandMark brand={t.brand} />}
                    <button type="button"
                      onClick={() => dismissToast(t.id)}
                      aria-label="Dismiss notification"
                      className="text-on-dark-2 hover:text-on-dark"
                    >
                      <Icon path={CLEAR_ICON} className="size-5 " />
                    </button>
                  </span>
                </div>

                {/* Full-bleed: a sibling of the header, not a child of it. */}
                <div className="border-t border-on-dark-line-1" />

                <div className="pad-panel">
                  {/* Two rows, one column per field. grid-rows-2 with
                      grid-flow-col puts each dt on the top row and its dd
                      directly beneath, while keeping dt/dd adjacent in the DOM
                      so the list stays semantically paired for a screen
                      reader. Five stacked label+value divs would look
                      identical only while every label fits on one line - the
                      moment one wraps, the value baselines stop aligning.

                      grid-rows-[auto_auto], NOT Tailwind's grid-rows-2: that
                      utility is repeat(2, minmax(0,1fr)), which forces both
                      rows to the SAME height. With two values wrapping to two
                      lines that made the label row 44px tall for a 19px line,
                      which reads as phantom padding under every label and is
                      not removable by touching padding, because there is
                      none - the dt has padding 0. Auto rows size to their own
                      content. */}
                  <dl className="toast-detail-grid">
                    {t.rows!.map((row) => (
                      <Fragment key={row.label}>
                        <dt className="text-on-dark-2 text-[length:var(--fs-caption)] leading-snug">{row.label}</dt>
                        <dd
                          className={`toast-row-title ${rowToneClass[row.tone ?? 'default']}`}
                        >
                          {/* An actionable value launches on click - the
                              purpose of visit starting its journey. Underlined
                              rather than merely coloured, because the value
                              keeps its row colour and colour alone would not
                              distinguish it from the three values that are
                              only text. */}
                          {row.value}
                          {/* Own line, at caption size and dimmed, so it
                              qualifies the value above without competing with
                              it for the row's visual weight. */}
                          {row.sub && (
                            <span className="toast-body">
                              {row.sub}
                            </span>
                          )}
                          {/* The breakdown, under the count. Each identifier
                              opens the owning Customer 360 tab with that
                              service loaded.

                              Dismissing on click is deliberate: the toast
                              overlays the page it is navigating to, so leaving
                              it up would cover the record the agent just asked
                              to see. Clicking a link does NOT trigger the
                              outside-click dismissal - the link is inside the
                              stack - so this is the only thing that closes
                              it. */}
                          {row.links && row.links.length > 0 && (
                            <span className="mt-1.5 stack gap-1 font-normal">
                              {row.links.map((link) => (
                                <Link
                                  key={link.label}
                                  to={`/customer/${link.customerId}`}
                                  state={{ tab: link.tab, serviceRef: link.serviceRef }}
                                  onClick={() => dismissToast(t.id)}
                                  // The product name is NOT displayed (2026-09-25 -
                                  // identifiers only), but it is still the link's
                                  // accessible name. "SVC-30011" read aloud on its own
                                  // says nothing about where the link goes, and an
                                  // aria-label is announced without being rendered, so
                                  // this costs the visual design nothing.
                                  aria-label={link.note ? `${link.label} - ${link.note}` : link.label}
                                  className={`toast-link`}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </span>
                          )}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              </>
            ) : (
              <div className="toast-row">
                <span className="eligibility-alert-icon toast-icon" aria-hidden="true">
                  <Icon path={ROW_ICON[KIND_OUTCOME[t.kind]]} className="size-5 " />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="toast-subject">{t.message}</p>
                  {t.detailLink ? (
                    <p className="caption-secondary leading-snug mt-0.5">
                      {t.detailLink.prefix}
                      <Link to={t.detailLink.to} onClick={() => dismissToast(t.id)} className="link underline font-medium">
                        {t.detailLink.label}
                      </Link>
                      {t.detailLink.suffix}
                    </p>
                  ) : (
                    t.detail && <p className="caption-secondary leading-snug mt-0.5">{t.detail}</p>
                  )}
                </div>
                <button type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss notification"
                  className="icon-button-bare"
                >
                  <Icon path={CLEAR_ICON} className="size-4 " />
                </button>
              </div>
            )}
          </div>
        );
      })}
        </div>
      ))}
    </div>
  );
}
