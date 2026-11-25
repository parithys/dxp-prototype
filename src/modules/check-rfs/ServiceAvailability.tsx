import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button, Card, Modal, type Column, Icon, Input, PhoneNumberInput, Select, Tooltip, FILE, ARROW_RIGHT, BARCODE_ICON, BOLT, BUILDING, CHEVRON_LEFT, HASH, HOUSE, INSTALLATION_WIFI, LAYERS_ICON, PIN, SEARCH, SIGNAL_TOWER, STAR, WARNING_ALT, WIFI } from 'dxp-ui';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { AVAILABILITY_STATUS, MBB_OFFERS, type AvailabilityBuilding, type AvailabilityStatusKey, type AvailabilityUnit } from '../../data/reference/serviceAvailabilityData';
import { Link, useLocation, useNavigate } from '../../lib/router';
import { returnToOf } from '../../lib/returnTo';
import { SYNTHETIC_CLASS } from '../../data/synthetic/syntheticMarker';
import { canUseFeature } from '../../engines/personaEngine';
import { canScanDevices } from '../../engines/agentPrivilegeEngine';
import { COMMON_CONTACT_FEATURE } from '../../engines/navigationEngine';
import { serviceStart } from './serviceJourneys';
import { fwaServiceTypeOf, homeStartOf, rfsDraftValues } from '../new-connection/rfsStart';
import type { RfsHandOff } from '../new-connection/rfsStart';
import { useAction, useAppSelector } from '../../stores/hooks';
import { notificationActions } from '../../stores/notificationSlice';
import { store } from '../../stores/store';
import { useEntityOps } from '../../services/entityHooks';
import { useEntityRecords } from '../../services/entityHooks';
import { isValidAltPhone } from '../../components/patterns/guidedContactModel';
import { kidInUseOf, orderInProgressForKid } from '../../engines/kidInUse';
import {
  SEARCH_MODES, DEMO_SCENARIOS, scanSample, availabilityAreas, demoScenarioValues, deviceReuseOf, deviceReuseTags, splitterWarningOf, buildingNames, fieldError, isSearchValid, lookupAvailability, modeById,
  type AvailabilityResult, type SearchModeId, type SearchValues,
} from './serviceAvailabilityModel';

// Check RFS > Service Availability: the agent finds a location by ZSB, KID, VFID or Area & Building and sees what can be sold there - fibre, 5G Home
// (FWA Indoor / Outdoor) or, where neither is open, Mobile Broadband. A KID / unit and, for a 5G Home location that offers both, the FWA type are chosen
// here; the Mobile Broadband offers lead on to Mobile Postpaid Activation. The lookup itself is serviceAvailabilityModel.ts.

// The service the verdict is about: fibre, 5G Home (FWA) or Mobile Broadband.
const HUB_ICON = { layers: LAYERS_ICON, antenna: SIGNAL_TOWER, wifi: WIFI } as const;
// The glyph on a verdict, by the result: fibre, the two 5G Home types, a building not yet open, nothing matched (EBU keeps its service glyph).
const STATUS_ICON: Partial<Record<AvailabilityStatusKey, string>> = {
  RFS_UNLIMITED: LAYERS_ICON, RFS_LIMITED: LAYERS_ICON, FWA_INDOOR: HOUSE, FWA_OUTDOOR: SIGNAL_TOWER, FWA_BOTH: INSTALLATION_WIFI, RFA: BUILDING, NOT_FOUND: SEARCH,
};
const MODE_ICON: Record<SearchModeId, string> = { zsb: PIN, kid: BOLT, vfid: HASH, area: BUILDING };
const CHECK_DELAY_MS = 650;
const LOCATION_COLUMNS: Column<AvailabilityBuilding>[] = [
  { key: 'area', header: 'Area', sortable: false },
  { key: 'zone', header: 'Zone', sortable: false },
  { key: 'street', header: 'Street', sortable: false },
  { key: 'building', header: 'Building', sortable: false },
];
const FIELDS_CLASS = { 1: 'avail-fields fields max-w-xl mt-6', 2: 'avail-fields fields-2 mt-6', 4: 'avail-fields fields sm:grid-cols-2 lg:grid-cols-4 mt-6' } as const;
const FWA_TYPES = ['Indoor', 'Outdoor'] as const;

// The filled tags (the plan-type tag family): a soft fill in the tag's colour, no outline.
const TAG_CLASS = { success: 'badge-success-solid', info: 'badge-tag-primary', neutral: 'badge-filled-neutral' } as const;

/** The splitter warning the feasibility response gave for the unit (Splitter Full, Splitter Not Mapped): a warning only, the order is not stopped. */
function SplitterWarning({ unit, bar = false }: { unit: AvailabilityUnit; bar?: boolean }) {
  const warning = splitterWarningOf(unit);
  if (!warning) return null;
  // `bar`: the result panel's full-width amber bar ("Attention needed · ..."); on a unit card it is an amber tag with the warning icon.
  return bar ? (
    <p role="alert" className="avail-attention">
      <Icon path={WARNING_ALT} className="size-3.5 shrink-0" />
      <span>Attention needed · {warning}</span>
    </p>
  ) : (
    <span role="alert" className="badge badge-tag-amber">
      <Icon path={WARNING_ALT} className="size-3.5 shrink-0" />
      {warning}
    </span>
  );
}

/** The device already at the unit (the feasibility response), with whether it can be reused and, from UIM's model mapping, whether it supports Zero Touch activation. */
function DeviceReuse({ unit, inline = false, extra }: { unit: AvailabilityUnit; inline?: boolean; extra?: ReactNode }) {
  const reuse = deviceReuseOf(unit);
  // In the result panel (`inline`) the device is just its tags - Reusable, Instant Activation - and nothing at all where there is no device; a unit card names the model too.
  if (inline) return reuse.status === 'none' ? null : <span className="cluster gap-1.5">{deviceReuseTags(reuse).map((t) => <span key={t.label} className={`badge ${TAG_CLASS[t.tone]}`}>{t.label}</span>)}</span>;
  // `extra`: a tag that sits in the same row as the device's own (a unit's splitter warning).
  if (reuse.status === 'none') return <div className="divider-top mt-3 pt-3 stack gap-1.5"><p className="caption-muted">No existing device at this location</p>{extra}</div>;
  return (
    <div className="divider-top mt-3 pt-3 stack gap-1.5">
      <span className="font-semibold text-fg">{reuse.model}</span>
      <span className="cluster gap-1.5">
        {deviceReuseTags(reuse).map((t) => (
          <span key={t.label} className={`badge ${TAG_CLASS[t.tone]}`}>{t.label}</span>
        ))}
        {extra}
      </span>
    </div>
  );
}

function UnitBody({ unit, selectable, selected, onInterested, busy }: { unit: AvailabilityUnit; selectable: boolean; selected: boolean; onInterested?: () => void; busy?: boolean }) {
  const label = /villa/i.test(unit.unit) ? unit.unit : `Unit ${unit.unit}`;
  return (
    <>
      <div className="row gap-2 mb-4 w-full">
        <Icon path={HOUSE} className="size-5 text-fg-2" />
        <span className="value-text-lg font-bold">{label}</span>
        <span className="caption-muted">Floor {unit.floor}</span>
        {onInterested && (
          // The same action as the Interested button at the foot of the card (it raises the same lead); a bordered icon button so it can sit in the header. It must not also select the unit.
          <span className="ml-auto">
            <Tooltip content="Create Lead" placement="top">
              <Button variant="secondary" size="icon" className="btn-icon-bordered text-fg size-9" aria-label={`Create Lead: interested in ${label}`} disabled={busy} onClick={(e) => { e.stopPropagation(); onInterested(); }} onKeyDown={(e) => e.stopPropagation()}>
                <Icon path={STAR} className="size-5" />
              </Button>
            </Tooltip>
          </span>
        )}
      </div>
      <dl className="avail-kv">
        <dt className="caption-muted">KID</dt>
        <dd className="tabular-nums">{unit.kid}</dd>
        <dt className="caption-muted">VFID</dt>
        <dd className="tabular-nums">{unit.vfid}</dd>
      </dl>
      <div className="avail-tags">
        <span>{unit.state}</span>
        {unit.patch && <span>{unit.patch}</span>}
        {unit.sla && <span>SLA {unit.sla} Hours</span>}
      </div>
      <DeviceReuse unit={unit} extra={<SplitterWarning unit={unit} />} />
      {onInterested && (
        <div className="row justify-end mt-auto pt-3">
          {/* The card is a control of its own (it selects the unit), so this button must not also select it. */}
          <Button variant="secondary" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); onInterested(); }} onKeyDown={(e) => e.stopPropagation()}>
            Interested
          </Button>
        </div>
      )}
      {selectable && selected && unit.state === 'In Service' && (
        <p className="row gap-1.5 mt-3 caption-muted text-[var(--warn-text)]">
          <Icon path={WARNING_ALT} className="size-3.5 shrink-0" />
          Active service exists on this unit — confirm relocation or ownership change.
        </p>
      )}
    </>
  );
}

export function ServiceAvailability() {
  const titleId = useId();
  const [modeId, setModeId] = useState<SearchModeId>('zsb');
  const [values, setValues] = useState<SearchValues>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  // The KID in use whose dialog the agent has closed with its X (the dialog only closes; Abandon Order is what leaves).
  const [dismissedKid, setDismissedKid] = useState<string | null>(null);
  const [fwaType, setFwaType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultRef = useRef<HTMLDivElement>(null);
  const personaId = useAppSelector((st) => st.persona.activePersonaId);
  const mode = modeById(modeId);
  const valid = isSearchValid(mode, values);

  useEffect(() => () => clearTimeout(timer.current), []);
  // A result that has just been found is scrolled into view (the page may be taller than the screen). It is not focused: focusing the container drew a focus border round the whole result.
  useEffect(() => {
    if (!result) return;
    const el = resultRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [result]);

  const clearResult = () => {
    setResult(null);
    setSelectedUnit(null);
    setSelectedOffer(null);
    setDismissedKid(null);
    setFwaType(null);
  };

  const chooseMode = (id: SearchModeId) => {
    if (id === modeId) return;
    clearTimeout(timer.current);
    setLoading(false);
    setModeId(id);
    setValues({});
    setTouched({});
    clearResult();
  };

  const onModeKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = SEARCH_MODES.findIndex((m) => m.id === modeId);
    const next = SEARCH_MODES[(i + (e.key === 'ArrowRight' ? 1 : -1) + SEARCH_MODES.length) % SEARCH_MODES.length];
    chooseMode(next.id);
    requestAnimationFrame(() => document.getElementById(`${titleId}-mode-${next.id}`)?.focus());
  };

  const setValue = (id: string, value: string) => {
    // The building list follows the area, so a new area drops a building chosen under the old one.
    setValues((v) => ({ ...v, [id]: value, ...(id === 'area' ? { bname: '' } : {}) }));
    if (result) clearResult();
  };

  // Demo shortcut: fills the current tab's fields with an entry that reaches the scenario (nothing is searched until Check Availability).
  const fillScenario = (status: (typeof DEMO_SCENARIOS)[number]['status']) => {
    clearTimeout(timer.current);
    setLoading(false);
    clearResult();
    setValues(demoScenarioValues(modeId, status));
    setTouched({});
  };

  // The KID and VFID fields take a barcode scan (simulated: the reader's output - an identifier from the inventory - lands in the field after a moment).
  const [scanningField, setScanningField] = useState<string | null>(null);
  const scanInto = (id: 'kid' | 'vfid') => {
    setScanningField(id);
    window.setTimeout(() => {
      setValue(id, scanSample(id));
      setTouched((t) => ({ ...t, [id]: true }));
      setScanningField(null);
    }, 600);
  };

  const runCheck = () => {
    setTouched(Object.fromEntries(mode.fields.map((f) => [f.id, true])));
    if (!valid || loading) return;
    setLoading(true);
    timer.current = setTimeout(() => {
      setLoading(false);
      clearResult();
      setResult(lookupAvailability(modeId, values));
    }, CHECK_DELAY_MS);
  };

  const status = result ? AVAILABILITY_STATUS[result.status] : undefined;
  const currentUnit: AvailabilityUnit | undefined = result?.single ? result.units?.[0] : result?.units?.find((u) => u.kid === selectedUnit);
  // The KID chosen: an order already on its way for it (whoever it is for) stops a new one, and a service it still carries (Active or Suspended) is a KID in use - the agent proceeds or cancels.
  const orders = (useEntityRecords('orders') ?? []) as unknown as { orderId: string; kid?: string; status?: string; existingConnection?: { kid?: string; state?: string } }[];
  const blockingOrder = currentUnit ? orderInProgressForKid(orders, currentUnit.kid) : undefined;
  const inUse = currentUnit && !blockingOrder ? kidInUseOf(currentUnit, orders) : undefined;
  // What the agent can do next, per outcome (AvailabilityStatus.proceed): a fibre / 5G Home connection needs its unit (or FWA type) first.
  const searched = mode.fields.filter((f) => values[f.id]?.trim());
  const proceed = status?.proceed;
  const start = proceed === 'fibre' || proceed === 'fwa' ? serviceStart(proceed) : undefined;
  // The result the connection starts from: the service and where it is, so New Home Connection asks for neither the address nor the RFS read again. `startRoute`: where the page that sent the agent here
  // wants the connection to start (an identified customer's own route).
  const navigate = useNavigate();
  const routeState = useLocation().state;
  const startRoute = (routeState as { startRoute?: string } | null)?.startRoute;
  const homeStart = homeStartOf(routeState);
  const b = result?.building;
  const handOff: RfsHandOff | undefined = b && (proceed === 'fibre' || proceed === 'fwa') && result
    ? {
        service: proceed, status: result.status, fwaType: (fwaType ?? undefined) as RfsHandOff['fwaType'], buildingName: b.name, kid: currentUnit?.kid, vfid: currentUnit?.vfid, kidInUse: inUse,
        address: { zone: b.zone, streetNo: b.street, buildingNo: b.building, aptFlatUnit: currentUnit?.unit, city: b.area },
      }
    : undefined;
  const canUseCommon = canUseFeature(personaId, COMMON_CONTACT_FEATURE);
  const allowed = Boolean(start?.journey.featureKey && canUseFeature(personaId, start.journey.featureKey));
  const startMbb = proceed === 'mbb' ? serviceStart('mbb') : undefined;
  const allowedMbb = Boolean(startMbb?.journey.featureKey && canUseFeature(personaId, startMbb.journey.featureKey));
  const waiting = proceed === 'fibre' ? !currentUnit : proceed === 'fwa' ? Boolean(status?.fwaChoice) && !fwaType : false;
  // Where Start New Home Connection leads (the same for the floating bar's button and the KID In Use dialog's Proceed).
  // `mode`: how the connection is activated - Field Engineer (the default, with an installation appointment) or Instant Activation (devices and SIM scanned in the journey). It travels in the draft values.
  const startTargetFor = (mode: 'instant' | 'field'): { to: string; state: Record<string, unknown> } | undefined =>
    start && allowed && !waiting && handOff
      ? homeStart || !canUseCommon
        ? {
            to: startRoute ?? start.to,
            state: { startFresh: true, navJourney: start.journey.id, startValues: { ...homeStart?.values, ...rfsDraftValues({ ...handOff, activation: mode }) }, ...(homeStart ? { startProgressTo: homeStart.progressTo } : {}) },
          }
        // Nobody is identified yet: the common Contact page does that (and the customer-level checks) first. The Check RFS result waits in its draft (`pendingHome`) until the agent chooses New Home
        // on Recommended Offers, which then opens the home journey without a second Check RFS.
        : { to: '/start-connection', state: { startFresh: true, startValues: { pendingHome: rfsDraftValues({ ...handOff, activation: mode }) } } }
      : undefined;
  const startTarget = startTargetFor('field');

  // The way forward for the outcome sits in the floating bar at the bottom of the screen (Back, where the agent came from another page, on its left): Start New Home Connection for a sellable
  // location, Continue to Mobile Postpaid Activation where neither fibre nor 5G Home is sold (RFA, not found, an EBU building).
  // Interested on a unit card: a lead for that unit's location (what is on offer there is the service the check found), as Interested on a Recommended Offer raises one for the offer.
  const createRecord = useEntityOps().createRecord;
  const pushToast = useAction(notificationActions.pushToast);
  const [leadBusy, setLeadBusy] = useState<string | null>(null);
  // Interested opens a dialog for the customer's Name and Mobile Number; the lead is created only once both are entered.
  const [interestedUnit, setInterestedUnit] = useState<AvailabilityUnit | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadMobile, setLeadMobile] = useState('');
  const [leadTouched, setLeadTouched] = useState(false);
  const leadNameOk = leadName.trim().length > 0;
  const leadMobileOk = isValidAltPhone(leadMobile);
  const closeInterested = () => {
    setInterestedUnit(null);
    setLeadName('');
    setLeadMobile('');
    setLeadTouched(false);
  };
  const createLead = async () => {
    const u = interestedUnit;
    setLeadTouched(true);
    if (!u || !result || !b || leadBusy || !leadNameOk || !leadMobileOk) return;
    setLeadBusy(u.kid);
    try {
      const leadId = `LEAD-${Date.now().toString().slice(-6)}`;
      await createRecord('leads', {
        leadId,
        serviceNeeded: 'Home',
        status: 'New',
        ownerId: store.getState().auth.profile?.userId ?? null,
        createdVia: 'Check RFS - Interested',
        customerName: leadName.trim(),
        mobileNumber: leadMobile,
        service: proceed === 'fibre' ? 'Fibre' : proceed === 'fwa' ? '5G Home' : undefined,
        rfsStatus: status?.label,
        buildingName: b.name,
        address: { zone: b.zone, streetNo: b.street, buildingNo: b.building, aptFlatUnit: u.unit, city: b.area },
        kid: u.kid,
        vfid: u.vfid,
      });
      pushToast('success', `Lead ${leadId} has been created`, { key: `lead-${leadId}` });
      closeInterested();
    } finally {
      setLeadBusy(null);
    }
  };
  // Abandon Order from the KID In Use dialog: nothing has been started, so the result is dropped and the agent goes back to the dashboard (Agent 360).
  const abandonOrder = () => {
    clearResult();
    navigate('/');
  };
  const back = returnToOf(routeState);
  // The bar's two ways on, by the service found: Fibre (Unlimited / Limited) and FWA Indoor offer Activate (Instant Activation: the journey scans the devices and SIM and has no appointment) and Field
  // Engineer (the Link below: the field engineer installs, and the journey books the appointment); FWA Outdoor only Field Engineer.
  const instantActivationOffered = result
    ? proceed === 'fibre' || (proceed === 'fwa' && fwaServiceTypeOf({ status: result.status, fwaType: (fwaType ?? undefined) as RfsHandOff['fwaType'] }) === 'fwa-indoor')
    : false;
  // ...and only where the unit's own device is reusable and its model supports Zero Touch: with no device at the location (or one that cannot be activated remotely) there is nothing to activate.
  const unitForActivation = currentUnit ?? (result?.single ? result.units?.[0] : undefined);
  // ...and only for a role that scans (`device-scan`): any other role goes the Field Engineer way.
  const instantTarget = startTargetFor('instant');
  const canActivate = Boolean(instantTarget && instantActivationOffered && !blockingOrder && !inUse && unitForActivation && deviceReuseOf(unitForActivation).status === 'zero-touch' && canScanDevices(personaId));
  const activate = () => instantTarget && navigate(instantTarget.to, { state: instantTarget.state });
  let action: ReactNode = null;
  if (result && (proceed === 'fibre' || proceed === 'fwa') && blockingOrder) {
    action = <Button size="lg" disabled>Order In Progress For This KID</Button>;
  } else if (result && (proceed === 'fibre' || proceed === 'fwa')) {
    const startAction = startTarget ? (
      <Link to={startTarget.to} state={startTarget.state} className="btn btn-primary btn-lg">
        Field Engineer
        <Icon path={ARROW_RIGHT} className="size-5" />
      </Link>
    ) : (
      <Button size="lg" disabled>{!start ? 'Not available' : !allowed ? 'Not available to your role' : proceed === 'fwa' ? 'Select a 5G Home type first' : 'Select a unit first'}</Button>
    );
    // A KID in use is put to the agent in a dialog (Cancel drops the result, Proceed carries on); the connection can start once they have proceeded, with a Tenancy Document to collect after the CAF.
    // While the dialog is closed the bar offers a way back to it: Proceed and Abandon Order are in the dialog.
    action = inUse ? (dismissedKid === currentUnit?.kid ? <Button size="lg" onClick={() => setDismissedKid(null)}>KID In Use</Button> : null) : startAction;
  } else if (result && proceed === 'mbb') {
    // Neither fibre nor 5G Home is sold here (RFA, not found, an EBU building): Mobile Broadband is, through Mobile Postpaid Activation.
    action = startMbb && allowedMbb ? (
      <Link to={startMbb.to} state={{ startFresh: true, navJourney: startMbb.journey.id }} className="btn btn-primary btn-lg">
        Continue to Mobile Postpaid Activation
        <Icon path={ARROW_RIGHT} className="size-5" />
      </Link>
    ) : (
      <Button size="lg" disabled>{startMbb ? 'Not available to your role' : 'Not available'}</Button>
    );
  }

  return (
    <>
    <Card className="p-8" role="region" aria-labelledby={titleId}>
      <h2 id={titleId} className="title title-xl mb-6">Service Feasibility</h2>

      <div className="row-between mb-4">
        <h3 className="title title-sm">Search By</h3>
      </div>
      <div role="radiogroup" aria-label="Search By" className="avail-modes" onKeyDown={onModeKey}>
        {SEARCH_MODES.map((m) => {
          const on = m.id === modeId;
          return (
            <button
              key={m.id}
              id={`${titleId}-mode-${m.id}`}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => chooseMode(m.id)}
              className={`avail-mode ${on ? CARD_SELECTED : CARD_IDLE}`}
            >
              <Icon path={MODE_ICON[m.id]} className="size-5.5 shrink-0" />
              <span>
                <span className="block font-semibold text-fg">{m.title}</span>
                <span className="caption-muted">{m.subtitle}</span>
              </span>
              {on && <SelectedTick />}
            </button>
          );
        })}
      </div>

      <div className={FIELDS_CLASS[mode.columns]} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runCheck(); } }}>
        {mode.fields.map((f) => {
          const error = touched[f.id] ? fieldError(f, values) : undefined;
          if (f.kind === 'area' || f.kind === 'building') {
            const names = f.kind === 'area' ? availabilityAreas() : buildingNames(values.area);
            return (
              <Select
                key={f.id}
                label={f.label}
                required={f.required}
                value={values[f.id] ?? ''}
                options={names.map((n) => ({ value: n, label: n }))}
                onChange={(e) => setValue(f.id, e.target.value)}
              />
            );
          }
          return (
            <div key={f.id}>
              <Input
                label={f.label}
                required={f.required}
                value={values[f.id] ?? ''}
                inputMode={f.numeric ? 'numeric' : undefined}
                autoComplete="off"
                // The scannable KID / VFID field takes focus when its tab is chosen (it remounts per tab), so the agent can scan or type at once.
                autoFocus={f.scan}
                watermark={f.watermark}
                error={error}
                onChange={(e) => setValue(f.id, e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, [f.id]: true }))}
                trailingAddon={
                  f.scan ? (
                    <Button variant="ghost" size="icon" type="button" onClick={() => scanInto(f.id as 'kid' | 'vfid')} disabled={scanningField !== null} aria-label={`Scan ${f.label} barcode`} title={scanningField === f.id ? 'Scanning…' : `Scan ${f.label} barcode`} className="icon-button-inline icon-button-quiet size-auto -mr-1.5">
                      <Icon path={BARCODE_ICON} className="size-4" />
                    </Button>
                  ) : undefined
                }
              />
            </div>
          );
        })}
      </div>

      <div className="split mt-5">
        {/* Demo only: shortcuts that fill the fields for each result category, on every tab. */}
        <div className={`cluster gap-x-4 gap-y-1 ${SYNTHETIC_CLASS}`}>
          <span className="demo-link-label">Demo:</span>
          {DEMO_SCENARIOS.map((d) => (
            <Button key={d.label} variant="link" className="demo-link" onClick={() => fillScenario(d.status)}>
              {d.label}
            </Button>
          ))}
        </div>
        <Button size="lg" disabled={!valid || loading} onClick={runCheck}>
          {loading ? <span aria-hidden="true" className="spinner-ring" /> : <Icon path={SEARCH} className="size-5" />}
          {loading ? 'Checking…' : 'Check Availability'}
          {!loading && <Icon path={ARROW_RIGHT} className="size-5" />}
        </Button>
      </div>

      <div aria-live="polite">
        {result && status && (
          <>
            <div ref={resultRef} role="group" aria-label="Availability result" className={`avail-result scroll-mt-6 ${result.building ? 'avail-result-ok' : ''}`}>
              <div role="status" className={`avail-verdict ${status.sellable ? 'avail-verdict-ok' : result.status === 'NOT_FOUND' ? 'avail-verdict-none' : 'avail-verdict-no'}`}>
                <span aria-hidden="true" className="avail-verdict-icon">
                  <Icon path={STATUS_ICON[result.status] ?? HUB_ICON[status.hub]} className="size-6" />
                </span>
                <span className="avail-verdict-eyebrow">{status.title.replace('Not Available', 'Unavailable')}</span>
                <h4 className="title-inherit title-xl">{status.label}</h4>
                <p>{status.text}</p>
              </div>

              {result.building && (
                <div className="avail-location avail-location-ok">
                  <div className="row gap-4">
                    <div className="avail-id">
                      <span className="caption-strong text-[var(--success-on-tint)] uppercase">Location Matched</span>
                      <h3 className="title title-lg">{result.building.name}</h3>
                      <span className="caption-muted">Matched on {mode.matchedOn}</span>
                    </div>
                    {status.sellable && result.units && result.single && (
                      <div className="avail-unit-tags">
                        <span className="avail-pill">{[result.units[0].state, result.units[0].sla ? `SLA ${result.units[0].sla} Hours` : undefined].filter(Boolean).join(' · ')}</span>
                        {result.units[0].patch && <span className="caption-muted">{result.units[0].patch}</span>}
                      </div>
                    )}
                  </div>
                  <dl className="avail-facts">
                    {LOCATION_COLUMNS.map((c) => (
                      <div key={c.key}>
                        <dt className="caption-muted">{c.header}</dt>
                        <dd className="title title-md">{result.building?.[c.key as keyof AvailabilityBuilding] as string}</dd>
                      </div>
                    ))}
                  </dl>
                  {status.sellable && result.units && result.single && (
                    <>
                      <dl className="avail-facts avail-facts-2">
                        <div>
                          <dt className="caption-muted">Kahramaa ID · Unit {result.units[0].unit}</dt>
                          <dd className="title title-md tabular-nums">{result.units[0].kid}</dd>
                        </div>
                        <div>
                          <dt className="caption-muted">Vodafone ID · Unit {result.units[0].unit}</dt>
                          <dd className="title title-md tabular-nums">{result.units[0].vfid}</dd>
                        </div>
                      </dl>
                      {/* The device tags and any warning, under a hairline of their own - only when there is something to show. */}
                      {(deviceReuseOf(result.units[0]).status !== 'none' || splitterWarningOf(result.units[0])) && (
                        <div className="avail-extras">
                          <DeviceReuse unit={result.units[0]} inline />
                          <SplitterWarning unit={result.units[0]} bar />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {!result.building && (
                <div className="avail-location">
                  <div className="row gap-4">
                    <div className="avail-id">
                      <span className="caption-strong text-muted uppercase">Location Not Matched</span>
                      <h3 className="title title-lg">No Match Found</h3>
                      <span className="caption-muted">Searched on {mode.matchedOn}</span>
                    </div>
                  </div>
                  <dl className={`avail-facts ${searched.length <= 2 ? 'avail-facts-2' : ''}`}>
                    {searched.map((f) => (
                      <div key={f.id}>
                        <dt className="caption-muted">{f.label}</dt>
                        <dd className="title title-md tabular-nums">{values[f.id]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            {status.sellable && result.units && status.fwaChoice && (
              <>
                <div className="row-between mt-6 mb-4">
                  <h3 className="title title-sm">Select 5G Home Type</h3>
                </div>
                <div role="radiogroup" aria-label="Select 5G Home Type" className="grid-2-up max-w-3xl">
                  {FWA_TYPES.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={fwaType === t} onClick={() => setFwaType(t)} className={`avail-mode ${fwaType === t ? CARD_SELECTED : CARD_IDLE}`}>
                      <Icon path={SIGNAL_TOWER} className="size-5.5 shrink-0 text-[var(--success-on-tint)]" />
                      <span>
                        <span className="block font-semibold text-fg">FWA {t}</span>
                        <span className="caption-muted">5G Home · {t} installation</span>
                      </span>
                      {fwaType === t && <SelectedTick />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {status.sellable && result.units && !status.fwaChoice && !result.single && (
              <>
                <div className="row-between mt-6 mb-4">
                  <h3 className="row gap-2 title title-sm">Select a KID / Unit <span className="count-chip">{result.units.length}</span></h3>
                  <span className={`caption-muted ${selectedUnit ? 'text-[var(--success-on-tint)]' : ''}`}>{selectedUnit ? 'Unit selected' : '02 / Unit selection'}</span>
                </div>
                <div role="radiogroup" aria-label="Select a KID or unit" className="avail-units">
                  {result.units.map((u) => (
                    <div
                      key={u.kid}
                      role="radio"
                      aria-checked={selectedUnit === u.kid}
                      tabIndex={0}
                      onClick={() => setSelectedUnit(u.kid)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setSelectedUnit(u.kid);
                        }
                      }}
                      className={`option-card ${selectedUnit === u.kid ? CARD_SELECTED : CARD_IDLE} p-5 text-left`}
                    >
                      {selectedUnit === u.kid && <SelectedTick />}
                      <UnitBody unit={u} selectable selected={selectedUnit === u.kid} onInterested={() => setInterestedUnit(u)} busy={leadBusy === u.kid} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {currentUnit && blockingOrder && (
              <div role="alert" className="mt-6 notice-danger pad-row stack gap-2">
                <h4 className="title-inherit title-md font-bold">Order In Progress For This KID</h4>
                <p>Order {blockingOrder.orderId} is already in progress for {currentUnit.kid}. A new order cannot be started on this KID until it is decided.</p>
              </div>
            )}

            {status.mbb && (
              <>
                <div className="row-between mt-6 mb-4">
                  <h3 className="title title-sm">Mobile Broadband (MBB) Offers</h3>
                  <Icon path={WIFI} className="size-5 text-accent" />
                </div>
                <div role="radiogroup" aria-label="Mobile broadband offers" className="grid-2-up lg:grid-cols-3">
                  {MBB_OFFERS.map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={selectedOffer === o.id} onClick={() => setSelectedOffer(o.id)} className={`option-card avail-offer ${selectedOffer === o.id ? CARD_SELECTED : CARD_IDLE}`}>
                      {selectedOffer === o.id && <SelectedTick />}
                      <span className="text-fg">{o.name}</span>
                      <span className="title title-lg mt-5">{o.data}</span>
                      <span className="caption-muted pb-5 border-b border-border-soft">Monthly Data</span>
                      <span className="mt-5 caption-muted">QAR <b className="title title-md">{o.price}</b> / month</span>
                      <span className="mt-3 caption-secondary">{o.terms}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Card>
    <Modal
      open={Boolean(interestedUnit)}
      onClose={closeInterested}
      title="Customer Details"
      subtitle={interestedUnit?.kid}
      icon={FILE}
      widthClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={closeInterested} disabled={Boolean(leadBusy)}>Cancel</Button>
          <Button onClick={() => void createLead()} disabled={Boolean(leadBusy)}>{leadBusy ? 'Creating…' : 'Create Lead'}</Button>
        </>
      }
    >
      <div className="stack gap-4">
        <Input
          label="Name"
          required
          autoComplete="off"
          value={leadName}
          error={leadTouched && !leadNameOk ? 'Enter the customer’s name.' : undefined}
          onChange={(e) => setLeadName(e.target.value)}
        />
        <PhoneNumberInput
          label="Mobile Number"
          required
          fixedIso="QA"
          maxNationalDigits={8}
          noAutoFocus
          value={leadMobile}
          placeholder="55667766"
          error={leadTouched && !leadMobileOk ? 'Enter a valid Qatar mobile number.' : undefined}
          onChange={(e) => setLeadMobile(e.target.value)}
        />
      </div>
    </Modal>
    <Modal
      open={Boolean(inUse && currentUnit && startTarget && dismissedKid !== currentUnit.kid)}
      // The X (and Escape) only close the dialog; the journey is left through Abandon Order.
      onClose={() => currentUnit && setDismissedKid(currentUnit.kid)}
      title="KID In Use"
      subtitle={currentUnit?.kid}
      icon={WARNING_ALT}
      widthClassName="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={abandonOrder}>Abandon Order</Button>
          <Button onClick={() => startTarget && navigate(startTarget.to, { state: startTarget.state })}>Proceed</Button>
        </>
      }
    >
      {inUse && currentUnit && (
        <div className="stack gap-3">
          <dl className="avail-facts avail-facts-flat">
            <div><dt className="caption-muted">Service FLN</dt><dd className="title title-md tabular-nums">{inUse.fln}</dd></div>
            <div><dt className="caption-muted">Status</dt><dd className="title title-md">{inUse.status}</dd></div>
            <div><dt className="caption-muted">PON</dt><dd className="title title-md tabular-nums">{inUse.pon}</dd></div>
          </dl>
          <p className="text-secondary">{currentUnit.kid} already has this service.</p>
        </div>
      )}
    </Modal>
    {(back || action || canActivate) && (
      <>
        <div aria-hidden="true" className="h-20" />
        <div className="action-bar bottom-0">
          <div className="row-between w-full footer-bar-pad">
            {back ? (
              <Button variant="secondary" aria-label={`Back to ${back.label}`} onClick={() => navigate(back.path, back.launch ? { state: { launch: back.launch } } : undefined)}>
                <Icon path={CHEVRON_LEFT} className="size-4" />
                Back
              </Button>
            ) : <span />}
            <div className="cluster gap-3">
              {canActivate && <Button size="lg" variant="secondary" onClick={activate}>Activate</Button>}
              {action}
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
