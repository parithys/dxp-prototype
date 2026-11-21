import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Card, DataTable, type Column, Icon, Input, Select, ARROW_RIGHT, BOLT, BUILDING, CHECK, CHECK_CIRCLE, CLOSE, HASH, HOUSE, LAYERS_ICON, PIN, SEARCH, SIGNAL_TOWER, WARNING_ALT, WIFI } from 'dxp-ui';
import { Link } from '../../lib/router';
import { canUseFeature } from '../../engines/personaEngine';
import { serviceStart } from './serviceJourneys';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { AVAILABILITY_STATUS, MBB_OFFERS, SERVICE_DEFS, type AvailabilityBuilding, type AvailabilityUnit, type ServiceChipState, type ServiceKey } from '../../data/reference/serviceAvailabilityData';
import { notificationActions } from '../../stores/notificationSlice';
import { useAction, useAppSelector } from '../../stores/hooks';
import {
  SEARCH_MODES, availabilityAreas, buildingNames, fieldError, isSearchValid, lookupAvailability, modeById,
  type AvailabilityResult, type SearchModeId, type SearchValues,
} from './serviceAvailabilityModel';

// Check RFS > Service Availability: the agent finds a location by ZSB, KID, VFID or Area & Building and sees what can be sold there - fibre, 5G Home
// (FWA Indoor / Outdoor) or, where neither is open, Mobile Broadband. A KID / unit and, for a 5G Home location that offers both, the FWA type are chosen
// here; the Mobile Broadband offers lead on to Mobile Postpaid Activation. The lookup itself is serviceAvailabilityModel.ts.

const MODE_ICON: Record<SearchModeId, string> = { zsb: PIN, kid: BOLT, vfid: HASH, area: BUILDING };
const HUB_ICON = { layers: LAYERS_ICON, antenna: SIGNAL_TOWER, wifi: WIFI } as const;
const SERVICE_ICON: Record<ServiceKey, string> = { fibre: LAYERS_ICON, fwa: SIGNAL_TOWER, mbb: WIFI };
const CHECK_DELAY_MS = 650;
const LOCATION_COLUMNS: Column<AvailabilityBuilding>[] = [
  { key: 'area', header: 'Area', sortable: false },
  { key: 'zone', header: 'Zone', sortable: false },
  { key: 'street', header: 'Street', sortable: false },
  { key: 'building', header: 'Building', sortable: false },
];
const FIELDS_CLASS = { 1: 'fields max-w-xl mt-6', 2: 'fields-2 mt-6', 4: 'fields sm:grid-cols-2 lg:grid-cols-4 mt-6' } as const;
const FWA_TYPES = ['Indoor', 'Outdoor'] as const;

// How a service reads on its card: sellable ones are the action, the rest are muted.
const serviceTone = (service: ServiceKey, state: ServiceChipState) => {
  if (state === 'on') return service === 'fwa' ? 'avail-service-fwa' : 'avail-service-on';
  return state === 'limited' ? 'avail-service-limited' : 'option-unavailable';
};

function UnitBody({ unit, selectable, selected }: { unit: AvailabilityUnit; selectable: boolean; selected: boolean }) {
  const label = /villa/i.test(unit.unit) ? unit.unit : `Unit ${unit.unit}`;
  return (
    <>
      <div className="row gap-2 mb-4 w-full">
        <Icon path={HOUSE} className="size-5 text-fg-2" />
        <span className="value-text-lg">{label}</span>
        <span className="caption-muted">Floor {unit.floor}</span>
        {selectable && <RadioMark on={selected} />}
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
      {selectable && selected && unit.state === 'In Service' && (
        <p className="row gap-1.5 mt-3 caption-muted text-[var(--warn-text)]">
          <Icon path={WARNING_ALT} className="size-3.5 shrink-0" />
          Active service exists on this unit — confirm relocation or ownership change.
        </p>
      )}
    </>
  );
}

function RadioMark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`avail-radio ${on ? 'avail-radio-on' : ''}`}>
      {on && <Icon path={CHECK} className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

export function ServiceAvailability() {
  const titleId = useId();
  const pushToast = useAction(notificationActions.pushToast);
  const [modeId, setModeId] = useState<SearchModeId>('zsb');
  const [values, setValues] = useState<SearchValues>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [fwaType, setFwaType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const personaId = useAppSelector((st) => st.persona.activePersonaId);
  const mode = modeById(modeId);
  const valid = isSearchValid(mode, values);

  useEffect(() => () => clearTimeout(timer.current), []);

  const clearResult = () => {
    setResult(null);
    setSelectedUnit(null);
    setSelectedOffer(null);
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
    setValues((v) => ({ ...v, [id]: value }));
    if (result) clearResult();
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
  const offerLabel = MBB_OFFERS.find((o) => o.id === selectedOffer)?.name;

  return (
    <Card className="p-8" role="region" aria-labelledby={titleId}>
      <h2 id={titleId} className="title title-xl mb-6">Service Availability</h2>

      <div className="row-between mb-4">
        <h3 className="title title-sm">Search By</h3>
        <span className="caption-muted">01 / Location</span>
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
          if (f.kind === 'area') {
            return (
              <Select
                key={f.id}
                label={f.label}
                required={f.required}
                value={values[f.id] ?? ''}
                options={availabilityAreas().map((a) => ({ value: a, label: a }))}
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
                list={f.kind === 'building' ? `${titleId}-buildings` : undefined}
                autoComplete="off"
                helperText={f.hint}
                error={error}
                onChange={(e) => setValue(f.id, e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, [f.id]: true }))}
              />
              {f.kind === 'building' && (
                <datalist id={`${titleId}-buildings`}>
                  {buildingNames(values.area).map((n) => <option key={n} value={n} />)}
                </datalist>
              )}
            </div>
          );
        })}
      </div>

      <div className="row-between mt-5">
        <span className="caption-muted"><span className="text-accent">*</span> Required fields</span>
        <Button size="lg" disabled={!valid || loading} onClick={runCheck}>
          {loading ? <span aria-hidden="true" className="spinner-ring" /> : <Icon path={SEARCH} className="size-5" />}
          {loading ? 'Checking…' : 'Check Availability'}
          {!loading && <Icon path={ARROW_RIGHT} className="size-5" />}
        </Button>
      </div>

      <div aria-live="polite">
        {result && status && (
          <>
            <div className={`avail-result ${status.sellable ? 'avail-result-ok' : 'avail-result-no'}`}>
              <div role="status" className="avail-result-head">
              <span aria-hidden="true" className={`avail-hub ${status.sellable ? 'avail-hub-ok' : 'avail-hub-no'}`}>
                <Icon path={HUB_ICON[status.hub]} className="size-6" />
                <span className={`avail-hub-mark ${status.sellable ? 'bg-[var(--success-solid)]' : 'bg-[var(--danger-solid)]'}`}>
                  <Icon path={status.sellable ? CHECK : CLOSE} className="size-3" strokeWidth={3.5} />
                </span>
              </span>
              <div className="min-w-0">
                <div className="wrap-center gap-x-3 gap-y-1">
                  <h4 className={`title-inherit title-lg row gap-2 ${status.sellable ? 'text-[var(--success-solid)]' : 'text-danger'}`}>
                    {status.sellable && <Icon path={CHECK_CIRCLE} className="size-6" />}
                    {status.title}
                  </h4>
                  <span className={`badge ${status.sellable ? 'badge-success' : 'badge-danger'}`}>{status.label}</span>
                </div>
                <p className="text-fg-2">{status.text}</p>
              </div>
              </div>

              <div className="avail-panel">
              <div className="row-between">
                <h3 className="title title-sm">Available Services</h3>
                <span className="caption-muted">Choose a service to start its journey</span>
              </div>
              <div className="avail-services" role="group" aria-label="Available Services">
              {SERVICE_DEFS.map((d) => {
                const [state, text] = status.services[d.key];
                const sellable = state === 'on' || state === 'limited';
                const start = sellable ? serviceStart(d.key) : undefined;
                const allowed = Boolean(start?.journey.featureKey && canUseFeature(personaId, start.journey.featureKey));
                const waiting = d.key === 'fibre' ? (status.sellable && !currentUnit) : d.key === 'fwa' ? (Boolean(status.fwaChoice) && !fwaType) : false;
                const body = (
                  <>
                    <span className="row gap-2 value-text-lg"><Icon path={SERVICE_ICON[d.key]} className="size-5" />{d.name}</span>
                    <span className="caption-secondary">{text}</span>
                    {sellable && start && (
                      <span className="row gap-1 mt-1 text-link">
                        {!allowed ? 'Not available to your role' : waiting ? (d.key === 'fwa' ? 'Select a 5G Home type first' : 'Select a unit first') : `Start ${start.journey.title}`}
                        {allowed && !waiting && <Icon path={ARROW_RIGHT} className="size-4" />}
                      </span>
                    )}
                  </>
                );
                if (start && allowed && !waiting) {
                  const unit = currentUnit;
                  return (
                    <Link
                      key={d.key}
                      to={start.to}
                      state={{ startFresh: true, navJourney: start.journey.id, serviceAvailability: { service: d.key, status: result.status, kid: unit?.kid, vfid: unit?.vfid, fwaType: fwaType ?? undefined, building: result.building?.name } }}
                      className={`avail-service ${serviceTone(d.key, state)}`}
                    >
                      {body}
                    </Link>
                  );
                }
                return <div key={d.key} aria-disabled={sellable ? true : undefined} className={`avail-service ${serviceTone(d.key, state)} ${sellable ? 'avail-service-hold' : ''}`}>{body}</div>;
              })}
              </div>
              </div>

              {result.building && (
                <div className="avail-panel avail-location">
                  <div className="avail-id">
                    <span className="row gap-2 caption-strong text-[var(--success-on-tint)] uppercase">
                      <Icon path={BUILDING} className="size-5" />
                      Location Matched
                    </span>
                    <h3 className="title title-md">{result.building.name}</h3>
                    <span className="chip caption-muted">Matched on {mode.matchedOn}</span>
                  </div>
                  <div className="w-fit max-w-full">
                    <DataTable<AvailabilityBuilding>
                      columns={LOCATION_COLUMNS}
                      rows={[result.building]}
                      rowKey={(b) => b.name}
                      pageSize={Infinity}
                      dense
                    />
                  </div>
                </div>
              )}
            </div>

            {status.sellable && result.units && result.single && (
              <div className="pt-5"><UnitBody unit={result.units[0]} selectable={false} selected={false} /></div>
            )}

            {status.sellable && result.units && status.fwaChoice && (
              <>
                <div className="row-between mt-6 mb-4">
                  <h3 className="title title-sm">Select 5G Home Type</h3>
                  <span className={`caption-muted ${fwaType ? 'text-[var(--success-on-tint)]' : ''}`}>{fwaType ? 'Type selected' : 'Required'}</span>
                </div>
                <div role="radiogroup" aria-label="Select 5G Home Type" className="grid-2-up max-w-3xl">
                  {FWA_TYPES.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={fwaType === t} onClick={() => setFwaType(t)} className={`avail-mode ${fwaType === t ? CARD_SELECTED : CARD_IDLE}`}>
                      <Icon path={SIGNAL_TOWER} className="size-5.5 shrink-0 text-[var(--success-on-tint)]" />
                      <span>
                        <span className="block font-semibold text-fg">FWA {t}</span>
                        <span className="caption-muted">5G Home · {t} installation</span>
                      </span>
                      <RadioMark on={fwaType === t} />
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
                    <button key={u.kid} type="button" role="radio" aria-checked={selectedUnit === u.kid} onClick={() => setSelectedUnit(u.kid)} className={`option-card ${selectedUnit === u.kid ? CARD_SELECTED : CARD_IDLE} p-5 text-left`}>
                      <UnitBody unit={u} selectable selected={selectedUnit === u.kid} />
                    </button>
                  ))}
                </div>
              </>
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
                      <span className="text-fg">{o.name}</span>
                      <span className="title title-lg mt-5">{o.data}</span>
                      <span className="caption-muted pb-5 border-b border-border-soft">Monthly Data</span>
                      <span className="mt-5 caption-muted">QAR <b className="title title-md">{o.price}</b> / month</span>
                      <span className="mt-3 caption-secondary">{o.terms}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <Button
                    onClick={() => pushToast('info', offerLabel ? `Handing off to Mobile Postpaid Activation · ${offerLabel}` : 'Handing off to Mobile Postpaid Activation')}
                  >
                    Continue to Mobile Postpaid Activation
                    <Icon path={ARROW_RIGHT} className="size-5" />
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
