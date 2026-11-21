import { Button, Icon, Tooltip, CHEVRON_DOWN, CHEVRON_UP, CLOCK_ICON, Card } from 'dxp-ui';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '../../lib/router';
import { getAllRoutes } from '../../engines/configEngine';
import { type ActiveCustomerSummary, customerContextActions } from '../../stores/customerContextSlice';
import { useAction } from '../../stores/hooks';

// Clock face - a clearer, at-a-glance "not available yet" signal than the
// dashed-border/muted-text treatment alone, which was too subtle to notice
// without hovering for the tooltip.

export interface ProductAction {
  label: string;
  /** One or two plain-English sentences on what this action actually does -
   * same style as the MNP Port-In choice screen's Postpaid/Prepaid cards
   * (MnpProcessChoiceScreen.tsx), so an agent can tell what an action means
   * without launching it first. */
  description: string;
  /** Existing screen this action launches, if one exists yet. Omit to show
   * an honest "not yet built" state instead of a fabricated screen. */
  screenId?: string;
  /**
   * Launches a route computed from the customer instead of a registered screen
   * - for a journey that needs the customer's identity in its URL (the
   * Existing Customer flow of New Connection). Counts as built.
   */
  path?: (customer: ActiveCustomerSummary) => string;
  /**
   * Whether this action needs the customer to already hold a service on this
   * tab. Drives the default filter; omit for an action that applies either
   * way, which is then always shown.
   *
   * Per ACTION rather than per group, because the groups genuinely mix the
   * two: "Number & SIM Services" holds SIM Replacement (needs a line) next to
   * MNP Port-In (how a customer with NO line brings one in), and "New
   * Activation" holds Fibre Activation next to IPTV, whose own description
   * says it goes "on top of the customer's home broadband service". Filtering
   * by group would have hidden exactly the action a new customer came in for.
   */
  appliesWhen?: 'has-service' | 'no-service';
}

export interface ProductActionGroup {
  title: string;
  actions: ProductAction[];
}

// The progressive-disclosure layer for Customer 360's product tabs: groups
// (Existing Customer Services / Number & SIM Services / New Connection,
// etc.) all expand by default so an agent sees every action group at once
// without expanding them one at a time - each group can still be collapsed
// independently via its own header. Launching an action sets the
// active-customer bridge then navigates to the EXISTING screen registered
// for it - no wizard is rewritten to support this, per GuidedContactStep's
// pre-fill patch.
export function ProductActionGroups({
  groups,
  customer,
  hasExistingService,
}: {
  groups: ProductActionGroup[];
  customer: ActiveCustomerSummary;
  /**
   * Whether the customer holds a service on this tab. `undefined` means NOT
   * YET KNOWN - the service inventory is still loading - and suppresses
   * filtering entirely rather than defaulting to false, which would briefly
   * hide every existing-customer action and then flip them back in.
   */
  hasExistingService?: boolean;
}) {
  const navigate = useNavigate();
  const setActiveCustomer = useAction(customerContextActions.setActiveCustomer);
  const [openTitles, setOpenTitles] = useState<Set<string>>(() => new Set(groups.map((g) => g.title)));
  const [showAll, setShowAll] = useState(false);

  const toggleGroup = (title: string) => {
    setOpenTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Where an action goes, or undefined when it has no destination (a screen that is not routed).
  // startFresh: starting a journey from Customer Details never resumes an old draft.
  const destinationOf = (action: ProductAction): { to: string; state?: { startFresh: true } } | undefined => {
    if (action.path) return { to: action.path(customer), state: { startFresh: true } };
    const route = action.screenId ? getAllRoutes().find((r) => r.screenId === action.screenId) : undefined;
    return route ? { to: route.path } : undefined;
  };
  const launch = (action: ProductAction) => {
    const dest = destinationOf(action);
    if (!dest) return;
    setActiveCustomer(customer);
    navigate(dest.to, { state: dest.state });
  };

  // An action applies if it is unmarked, or if its marker matches what the
  // customer actually holds. Unknown state applies everything.
  const applies = (action: ProductAction) =>
    hasExistingService === undefined ||
    action.appliesWhen === undefined ||
    (action.appliesWhen === 'has-service') === hasExistingService;

  // Groups are filtered by their ACTIONS, and a group left with none drops
  // out entirely - so a mobile-only customer does not see an empty "New
  // Activation" header on the Fibre tab.
  const applicableGroups = groups
    .map((group) => ({ ...group, actions: group.actions.filter(applies) }))
    .filter((group) => group.actions.length > 0);

  const totalActions = groups.reduce((n, g) => n + g.actions.length, 0);
  const applicableActions = applicableGroups.reduce((n, g) => n + g.actions.length, 0);
  const hiddenCount = totalActions - applicableActions;
  const visibleGroups = showAll ? groups : applicableGroups;

  return (
    <div className="space-y-2.5">
      {/* Only when something is actually hidden. A permanent toggle that
          sometimes changes nothing is worse than no toggle: the agent cannot
          tell whether they are seeing everything. */}
      {hiddenCount > 0 && (
        <div className="split-nowrap pb-1">
          <p className="caption-muted">
            {showAll
              ? `Showing all ${totalActions} services.`
              : `Showing ${applicableActions} services for this customer's connection.`}
          </p>
          <Button variant="tertiary" size="sm" className="shrink-0" onClick={() => setShowAll((prev) => !prev)} aria-pressed={showAll}>
            {showAll ? 'Show applicable only' : `Show all (${hiddenCount} more)`}
          </Button>
        </div>
      )}
      {visibleGroups.map((group) => {
        const isOpen = openTitles.has(group.title);
        return (
          <Card key={group.title} className="overflow-hidden">
            <button type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={isOpen}
              className="list-row justify-between pad-row"
            >
              <span className="value-text">{group.title}</span>
              <Icon path={isOpen ? CHEVRON_UP : CHEVRON_DOWN} className="icon-sm text-muted" />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 action-grid divider-top pt-3">
                {group.actions.map((action) => {
                  const available = Boolean(action.path || (action.screenId && getAllRoutes().find((r) => r.screenId === action.screenId)));
                  if (!available) {
                    return (
                      <Tooltip key={action.label} content="Not yet built for this action" placement="top">
                        <div className="stack gap-2 card-unavailable p-4">
                          <div className="split-top gap-2">
                            <span className="caps-compact">{action.label}</span>
                            <Icon path={CLOCK_ICON} className="icon-xs" />
                          </div>
                          <p className="text-[length:var(--fs-caption)] leading-snug">{action.description}</p>
                        </div>
                      </Tooltip>
                    );
                  }
                  return (
                    // Same soft-pink treatment as every other secondary/
                    // clickable button in the app (2026-09-27) - see
                    // DashboardZone's Quick actions for the identical change
                    // and the same reasoning. The description line keeps its
                    // own --fg-2 explicitly, so only the action label itself
                    // takes the deep-red - a card that turned entirely one
                    // colour would lose the label/description hierarchy this
                    // already had.
                    <ActionTile key={action.label} dest={destinationOf(action)} onFollow={() => setActiveCustomer(customer)} onInert={() => launch(action)}>
                      <span className="caps-compact">{action.label}</span>
                      <p className="caption-secondary leading-snug">{action.description}</p>
                    </ActionTile>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** An action card: a link to its destination; an action with no routed destination keeps the old inert button (a click did nothing). */
function ActionTile({ dest, onFollow, onInert, children }: { dest: { to: string; state?: { startFresh: true } } | undefined; onFollow: () => void; onInert: () => void; children: ReactNode }) {
  const cls = 'stack gap-2 card card-button text-fg';
  return dest ? (
    <Link to={dest.to} state={dest.state} onClick={onFollow} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onInert} className={cls}>
      {children}
    </button>
  );
}
