import { useEffect, useRef, useState } from 'react';
import { Button, Card, Drawer, CloseButton, Modal, WARNING } from 'dxp-ui';
import { SimTypeStep } from '../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../components/domain/SimTypeStep';
import { isSimComplete } from '../../components/patterns/prepaidCartModel';
import { MULTI_SIM_MAX, multiSimCountOf, multiSimCoverages, multiSimRequestedOf } from '../../engines/multiSim';
import { listEntities } from '../../services/entityOps';

/**
 * The Multi SIM add-on's SIM Selection, on the Addons page itself. Choosing a Multi SIM add-on (paid or free) opens the SIM Selection in a side drawer - the agent stays on the page - for each
 * SIM the add-on provides (a Physical SIM or an eSIM). Once a SIM is selected the page lists it - SIM Type and SIM Serial Number - with an Edit to change the selection. A Multi-SIM is another SIM
 * on the Primary SIM's MSISDN: no number is chosen or allocated here. The SIMs are the order's `multiSims` (the SIM Selection page reads the same list); they number what the selected
 * add-ons provide, held to the maximum, and the list is trimmed when an add-on is removed.
 */
export function MultiSimAddonSims({
  addonIds,
  multiSims,
  onChange,
  onPendingChange,
  statusValue,
  onStatusChange,
  openRequest,
  onRemoveAddon,
  wanted = {},
  onWantedChange,
  primarySerial,
  primaryIccid,
  approvalRequired,
}: {
  addonIds: readonly string[];
  multiSims: readonly SimTypeValue[];
  onChange: (sims: SimTypeValue[] | undefined) => void;
  /** True while a selected Multi SIM add-on still lacks a SIM: the page holds Continue. */
  onPendingChange: (pending: boolean) => void;
  /** The status each Multi SIM add-on's card shows (read back, to write only a change) and where it is reported. */
  statusValue: Record<string, { label: string; complete: boolean; lines?: string[] }> | undefined;
  onStatusChange: (status: Record<string, { label: string; complete: boolean; lines?: string[] }> | undefined) => void;
  /** The agent clicked a selected Multi SIM add-on's card: open its SIM Selection. `n` tells one request from the next (a request already there on arrival is not one). */
  openRequest: { id: string; n: number } | undefined;
  /** Every SIM of an add-on was removed in the drawer: the add-on is deselected. */
  onRemoveAddon: (addonId: string) => void;
  /** How many of an add-on's SIMs the agent has asked for (one by default; "Add Next Multi SIM" asks for the next), by add-on id, and where that is kept. */
  wanted?: Record<string, number>;
  onWantedChange: (wanted: Record<string, number>) => void;
  primarySerial?: string;
  primaryIccid?: string;
  approvalRequired?: boolean;
}) {
  const [products, setProducts] = useState<{ productId: string; name: string; multiSimCount?: number; multiSimCoverage?: string[]; exclusiveGroup?: string }[] | undefined>();
  useEffect(() => {
    let live = true;
    void listEntities<{ productId: string; name: string; multiSimCount?: number; multiSimCoverage?: string[]; exclusiveGroup?: string }>('products').then((all) => live && setProducts(all));
    return () => {
      live = false;
    };
  }, []);

  // An add-on that provides several SIMs asks for one by default; the agent adds the next one if required, up to what the add-on provides.
  const fullOf = (id: string) => multiSimCountOf(products?.find((p) => p.productId === id));
  const countOf = (id: string) => multiSimRequestedOf(products?.find((p) => p.productId === id), wanted);
  // What was asked for, as of the latest action: the page's value follows a moment later, so two quick actions (Add Next twice) must build on this, not on the render they started in.
  const wantedNow = useRef(wanted);
  const wantedKey = JSON.stringify(wanted);
  useEffect(() => {
    wantedNow.current = wanted;
  }, [wantedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const setWanted = (next: Record<string, number>) => {
    wantedNow.current = next;
    onWantedChange(next);
  };
  const countNow = (id: string) => multiSimRequestedOf(products?.find((p) => p.productId === id), wantedNow.current);
  const total = products ? Math.min(MULTI_SIM_MAX, addonIds.reduce((n, id) => n + countOf(id), 0)) : 0;
  const held = multiSims.slice(0, total);
  // What each SIM covers (Local, GCC), from the add-on's own record.
  const coverage = products ? addonIds.flatMap((id) => multiSimCoverages([products.find((p) => p.productId === id) ?? {}]).slice(0, countOf(id))) : [];
  const completeLeading = held.findIndex((s) => !isSimComplete(s));
  const firstIncomplete = completeLeading === -1 ? held.length : completeLeading;
  const pending = total > 0 && (held.length < total || held.some((s) => !isSimComplete(s)));

  // What each selected Multi SIM add-on's card says: its SIMs run in the order the add-ons were chosen, so an add-on's SIMs are the next `count` after those of the add-ons before it.
  const status: Record<string, { label: string; complete: boolean; lines: string[] }> = {};
  if (products) {
    let at = 0;
    for (const id of addonIds) {
      const n = countOf(id);
      if (n === 0) continue;
      // One line per SIM of this add-on that is in: "SIM 1 - eSIM - 8974412009900140101" (an eSIM's serial is its ICCID, as everywhere).
      const lines = Array.from({ length: n }, (_, k) => ({ sim: held[at + k], no: at + k + 1 }))
        .filter(({ sim }) => isSimComplete(sim))
        .map(({ sim, no }) => `SIM ${no} - ${sim?.simType === 'eSIM' ? 'eSIM' : 'Physical SIM'} - ${(sim?.simType === 'eSIM' ? sim.simIccid : sim?.simSerial) ?? '-'}`);
      at += n;
      const complete = lines.length === n;
      status[id] = { complete, lines, label: complete ? '' : lines.length === 0 ? 'SIM not selected yet' : `${lines.length} of ${n} SIMs selected` };
    }
  }
  const statusKey = JSON.stringify(status);
  useEffect(() => {
    if (!products) return;
    if (JSON.stringify(statusValue ?? {}) !== statusKey) onStatusChange(Object.keys(status).length > 0 ? status : undefined);
  }, [statusKey, products]); // eslint-disable-line react-hooks/exhaustive-deps

  // The SIM slots an add-on owns: its SIMs run in the order the add-ons were chosen.
  const rangeOf = (id: string): { from: number; to: number } | undefined => {
    if (!products) return undefined;
    let at = 0;
    for (const a of addonIds) {
      const n = countOf(a);
      if (a === id) return n > 0 ? { from: at, to: at + n } : undefined;
      at += n;
    }
    return undefined;
  };

  // An add-on that left the order forgets how many of its SIMs were asked for: selected again, it starts with one.
  useEffect(() => {
    const stale = Object.keys(wanted).filter((id) => !addonIds.includes(id));
    if (stale.length > 0) onWantedChange(Object.fromEntries(Object.entries(wanted).filter(([id]) => addonIds.includes(id))));
  }, [addonIds.join('|'), Object.keys(wanted).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = useRef(multiSims);
  useEffect(() => {
    latest.current = multiSims;
  });
  useEffect(() => {
    onPendingChange(pending);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  // An add-on was removed: the SIMs beyond what the rest provide are dropped. Only once the catalogue is read (until then the count is unknown, not zero).
  useEffect(() => {
    if (products && multiSims.length > total) onChange(total === 0 ? undefined : multiSims.slice(0, total));
  }, [products, total, multiSims.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // The drawer: which SIMs it takes (from, up to), and what is typed so far for them.
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SimTypeValue>>({});
  // Remove SIM: whether a container was removed in this drawer (it then saves with Done), and the container waiting for the agent's confirmation - one that already holds a
  // generated or recorded SIM is asked about first, an empty one goes at once.
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  // Opens when a Multi SIM add-on is newly selected.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!products) return;
    const providing = new Set(addonIds.filter((id) => multiSimCountOf(products.find((p) => p.productId === id)) > 0));
    const previous = seen.current;
    seen.current = providing;
    if (previous === null) return; // the page opened with these already selected: nothing is newly chosen
    const fresh = [...providing].filter((id) => !previous.has(id));
    if (fresh.length > 0 && total > firstIncomplete) {
      setDrafts({});
      setRange({ from: firstIncomplete, to: total });
    }
  }, [addonIds.join('|'), products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking a selected Multi SIM add-on's card opens its SIM Selection (the drawer), whatever its state. Handled while rendering (a new request number, once the catalogue is read).
  const [handledRequest, setHandledRequest] = useState(openRequest?.n);
  if (openRequest && products && openRequest.n !== handledRequest) {
    setHandledRequest(openRequest.n);
    const r = rangeOf(openRequest.id);
    if (r) {
      setDrafts({});
      setRange(r);
    }
  }

  if (total === 0) return null;

  const valueAt = (i: number): SimTypeValue => drafts[i] ?? held[i] ?? {};
  const commit = (i: number, sim: SimTypeValue) => {
    setDrafts((d) => ({ ...d, [i]: sim }));
    // Only a finished SIM is kept; what is half-typed stays a draft, so the SIM already held is not lost while it is being changed.
    if (!isSimComplete(sim)) return;
    const next = [...latest.current];
    while (next.length < i) next.push({});
    next[i] = sim;
    latest.current = next;
    onChange(next);
  };
  const othersSerials = (i: number) => [primarySerial, ...held.map((s, k) => (k === i ? undefined : s.simSerial))].filter((x): x is string => Boolean(x));
  const othersIccids = (i: number) => [primaryIccid, ...held.map((s, k) => (k === i ? undefined : s.simType === 'eSIM' ? s.simIccid : undefined))].filter((x): x is string => Boolean(x));
  // Remove SIM. The first Multi SIM keeps its container (it is the add-on's own): Remove SIM there only clears the SIM's details, and is offered only once a SIM is selected or generated.
  // A second or later container always has Remove SIM: it clears the SIM and takes the container out of the drawer.
  const ownerOf = (i: number) => {
    const owner = addonIds.find((id) => {
      const r = rangeOf(id);
      return r && i >= r.from && i < r.to;
    });
    return { owner, r: owner ? rangeOf(owner) : undefined };
  };
  const isFirstOf = (i: number) => ownerOf(i).r?.from === i;
  const removeSim = (i: number) => {
    const { owner, r } = ownerOf(i);
    setRemoved(true);
    if (owner && r && i === r.from) {
      setDrafts((d) => {
        const { [i]: _gone, ...rest } = d;
        return rest;
      });
      const next = [...latest.current];
      if (i < next.length) next[i] = {};
      latest.current = next;
      onChange(next);
      return;
    }
    // Drafts of the containers after it move up with them.
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== i).map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v])));
    const next = [...latest.current];
    if (i < next.length) next.splice(i, 1);
    latest.current = next;
    onChange(next.length > 0 ? next : undefined);
    setRange((cur) => (cur ? { ...cur, to: Math.max(cur.from + 1, cur.to - 1) } : cur));
    if (owner) {
      if (countNow(owner) <= 1) onRemoveAddon(owner);
      else setWanted({ ...wantedNow.current, [owner]: countNow(owner) - 1 });
    }
  };
  // Whether removing holds a SIM worth asking about: a generated or recorded serial is confirmed first; an empty container goes at once.
  const needsConfirm = (i: number) => isSimComplete(valueAt(i));
  // Closing the drawer saves it: an add-on in it left with no SIM at all is deselected on the Addons page (with its slots); one with some SIMs keeps just those - a container
  // never filled is dropped, so what is saved is what was selected.
  const close = () => {
    if (range) {
      let next = [...latest.current];
      let changed = false;
      const nextWanted = { ...wantedNow.current };
      for (const id of [...addonIds].reverse()) {
        const r = rangeOf(id);
        if (!r || r.to <= range.from || r.from >= range.to) continue;
        const mine = Array.from({ length: r.to - r.from }, (_, k) => next[r.from + k]);
        const done = mine.filter((sim) => isSimComplete(sim));
        if (done.length === 0) {
          next = [...next.slice(0, r.from), ...next.slice(r.to)];
          changed = true;
          onRemoveAddon(id);
        } else if (done.length < mine.length) {
          next = [...next.slice(0, r.from), ...done, ...next.slice(r.to)];
          nextWanted[id] = done.length;
          changed = true;
        }
      }
      if (changed) {
        latest.current = next;
        onChange(next.length > 0 ? next : undefined);
        setWanted(nextWanted);
      }
    }
    setRange(null);
    setDrafts({});
    setRemoved(false);
  };
  // "Add Next Multi SIM": offered while the drawer is open for an add-on and it can still give another SIM (up to what it provides, and 4 SIMs in all). The benefit
  // type - Local or GCC - is the add-on's, so every SIM added is the same type; the two are never mixed.
  const current = range && products ? addonIds.find((id) => { const r = rangeOf(id); return r && range.from >= r.from && range.from < r.to; }) : undefined;
  const canAddNext = Boolean(current) && countOf(current as string) < fullOf(current as string) && total < MULTI_SIM_MAX;
  const addNext = () => {
    if (!current || !range || !canAddNext) return;
    setWanted({ ...wantedNow.current, [current]: countNow(current) + 1 });
    setRange({ from: range.from, to: range.to + 1 });
  };
  const slots = range ? Array.from({ length: Math.max(0, range.to - range.from) }, (_, k) => range.from + k) : [];
  // Done saves: once every container has its SIM, or after a container was removed (that is a change to save).
  const allDone = slots.length > 0 && (removed || slots.every((i) => isSimComplete(valueAt(i))));

  return (
    <>
      <Drawer
        open={range !== null}
        onClose={close}
        header={
          <div className="drawer-header">
            <h2 className="title title-xl">{range && coverage[range.from] ? `Multi SIM (${coverage[range.from]})` : 'Multi SIM'}</h2>
            <CloseButton onClick={close} />
          </div>
        }
        // Named for what the SIMs cover, from the add-on's own record: "Multi SIM (Local)", "Multi SIM (GCC)"; each SIM in it is Multi SIM 1, 2 ...
        title={range && coverage[range.from] ? `Multi SIM (${coverage[range.from]})` : 'Multi SIM'}
        footer={
          <Button disabled={!allDone} onClick={close}>
            Done
          </Button>
        }
      >
        <div className="stack gap-6">
          {/* One container per SIM, all shown at once: each is selected and changed on its own. */}
          {slots.map((i) => (
            <Card key={i} className="p-5 stack gap-4" aria-label={`Multi SIM ${i + 1}`}>
              <div className="split-nowrap">
                <h3 className="title title-sm font-semibold">Multi SIM {i + 1}</h3>
                {/* First Multi SIM: only once a SIM is selected or generated (it clears the details). Any later one: always (it clears them and removes the container). */}
                {(!isFirstOf(i) || isSimComplete(valueAt(i))) && (
                  <Button variant="tertiary" size="sm" onClick={() => (needsConfirm(i) ? setConfirming(i) : removeSim(i))}>
                    Remove SIM
                  </Button>
                )}
              </div>
              <SimTypeStep
                value={valueAt(i)}
                customerEmail={undefined}
                onChange={(v) => commit(i, v)}
                approvalRequired={approvalRequired}
                excludeSerials={othersSerials(i)}
                excludeIccids={othersIccids(i)}
                autoFocus={i === range?.from}
                stacked
              />
            </Card>
          ))}
          {canAddNext && (
            <div>
              <Button variant="secondary" onClick={addNext}>
                Add Next Multi SIM
              </Button>
            </div>
          )}
        </div>
      </Drawer>
      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Remove This SIM?"
        icon={WARNING}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirming !== null) removeSim(confirming);
                setConfirming(null);
              }}
            >
              Remove SIM
            </Button>
          </>
        }
      >
        <p className="body-text">
          {confirming !== null && (
            <span className="font-medium">
              {isSimComplete(valueAt(confirming))
                ? `Multi SIM ${confirming + 1} - ${valueAt(confirming).simType === 'eSIM' ? 'eSIM' : 'Physical SIM'} - ${(valueAt(confirming).simType === 'eSIM' ? valueAt(confirming).simIccid : valueAt(confirming).simSerial) ?? '-'}`
                : `Multi SIM ${confirming + 1}`}
            </span>
          )}{' '}
          {confirming !== null && isFirstOf(confirming)
            ? 'will be cleared. You can select another SIM for this Multi SIM afterwards.'
            : 'will be removed from this order. You can add another Multi SIM afterwards.'}
        </p>
      </Modal>
    </>
  );
}
