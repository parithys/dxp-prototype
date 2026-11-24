import { useEffect, useState } from 'react';
import { listEntities } from '../../../services/entityOps';
import { homePlanSourceOf } from '../../../components/patterns/homePlanModel';
import { useHomeCreditCheck } from '../../../components/patterns/homeCreditCheck';

type Values = Record<string, unknown>;

/**
 * What the plan page does in the background, for a plan an accepted offer chose on Recommended Offers (the page itself is passed over): the credit check, and the plan's source (an Offers-tab plan is
 * pre-bundled) that the page records when the agent chooses a plan. Renders nothing.
 */
export function HomeOfferPlanSettler({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  useHomeCreditCheck(values, setValue);
  const planId = values.productId as string | undefined;
  const [source, setSource] = useState<string | undefined>();
  useEffect(() => {
    void listEntities<{ productId: string; offer?: boolean }>('products').then((all) => setSource(homePlanSourceOf(all.find((p) => p.productId === planId))));
  }, [planId]);
  useEffect(() => {
    if (source !== (values.selectionSource as string | undefined)) setValue('selectionSource', source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  return null;
}
