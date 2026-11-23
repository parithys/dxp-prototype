import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { canUseFeature } from '../../../engines/personaEngine';

import { HOME_CONNECTION_FEATURE, canStartProduct } from '../productAccess';
import { JourneyCardButton, NewJourneyButtons, SERVICE_JOURNEYS, crossSalesSummary } from '../../../capabilities';
import { ICONS_HOME, Card } from 'dxp-ui';
import { StartCards } from './StartCards';
import { ProductSelection } from './ProductSelection';
import type { ProductStepContext } from './ProductSelection';
import { handOverHomeToRfs, productEligibilityClear, selectProduct } from './productChoice';
export { productEligibilityClear } from './productChoice';
import { PRODUCT_OF_OFFER_JOURNEY, homeProductLabel, mnpTypeOfOffer, productLabel } from '../products';
import type { ConnectionProduct, HomeProduct } from '../products';

import { rfsStarted } from '../rfsStart';
import { homeInstallationReady, serviceTypeLabel } from '../../fixed-line-fibre/fixedActivation/fixedActivationModel';
import { store } from '../../../stores/store';

/**
 * The four product buttons in Recommended Offers' floating bar (New Home, New MNP, New Prepaid, New Postpaid), shown beside the Offers & Plans cards
 * above the page (aboveCard below), which choose the same journeys. Set to false to hide the buttons again; the bar itself stays (Back is in it).
 */
const SHOW_FOOTER_JOURNEY_BUTTONS = true;

/**
 * The Offers & Plans start cards above Recommended Offers (aboveCard below) are hidden, not removed: the journeys are chosen from the floating bar's cards instead.
 * Set to true to show them again.
 */
const SHOW_START_CARDS = false;

const productSummary = [
  { key: 'product', label: 'Product', type: 'text' as const, value: (v: Record<string, unknown>) => (v.product === 'fixed-line' && v.homeProduct ? homeProductLabel(v.homeProduct as HomeProduct) : productLabel(v.product as ConnectionProduct | undefined)) },
];

/**
 * New Home Connection started from Check RFS: Recommended Offers in place of the product cards (the check named the product). It lists the home offers that fit the service found - none when the
 * offer was already chosen in New Connection - and judges the product's eligibility, moving on by itself when that is clear. Active only when the journey began from Check RFS.
 */
export function homeOffersStep(ctx: ProductStepContext): WizardStep {
  return {
    key: 'homeOffers',
    label: 'Recommended Offers',
    heading: 'Recommended Offers',
    subheading: 'Personalised using the customer’s profile and eligibility.',
    summary: [...crossSalesSummary, ...productSummary, { key: 'serviceType', label: 'Service Type', type: 'text' as const, optional: true, value: (v: Record<string, unknown>) => serviceTypeLabel((v.installation as { serviceType?: string } | undefined)?.serviceType) }],
    render: ({ values, setValue, goNext }) => <ProductSelection values={values} setValue={setValue} goNext={goNext} ctx={ctx} variant="offers" />,
    isValid: (values) => Boolean(values.product) && productEligibilityClear(values, { requireHomeKind: true }) && homeInstallationReady(values),
    skip: (values) => !rfsStarted(values),
  };
}

/**
 * Product selection, the second step of both journeys (see ProductSelection). Continue needs a product and its eligibility
 * judged and clear. Choosing a product with a footer button, or arriving through an entry point that already names it, sets
 * `productPreselected`: the page then moves on by itself once that eligibility is clear and quiet (once - the flag is cleared),
 * and stays when it is not, so whatever needs the agent's decision is on screen; Back always returns to it.
 *
 * New Connection keeps its original page: "Recommended offers", with the four product buttons in the footer (New Fixed Line,
 * New MNP, New Prepaid, New Postpaid). The buttons are unchanged; choosing one continues in THIS wizard rather than leaving
 * it. New Home Connection shows its four home products as cards.
 */
export function productStep(ctx: ProductStepContext): WizardStep {
  if (ctx.journey === 'home') {
    return {
      // Not `product`: that key is New Connection's Recommended Offers page, the one with Customer view (customerViewPolicy.ts).
      key: 'productSelection',
      label: 'Product Selection',
      heading: 'Product Selection',
      subheading: 'Choose the product the customer wants; the journey continues from here.',
      summary: [...productSummary, { key: 'serviceType', label: 'Service Type', type: 'text' as const, optional: true, value: (v: Record<string, unknown>) => serviceTypeLabel((v.installation as { serviceType?: string } | undefined)?.serviceType) }],
      render: ({ values, setValue, goNext }) => <ProductSelection values={values} setValue={setValue} goNext={goNext} ctx={ctx} />,
      // The Address was given before this page: Fibre also needs it read as RFS and FWA its service type, shown under the cards.
      isValid: (values) => Boolean(values.product) && productEligibilityClear(values, { requireHomeKind: true }) && homeInstallationReady(values),
      // Not asked when the journey began from Check RFS: the check named the product (see homeOffersStep).
      skip: rfsStarted,
    };
  }
  return {
    key: 'product',
    // The floating bar here carries the Start Another Journey options, so it is taller than the standard one.
    tallFooter: true,
    label: 'Recommended Offers',
    heading: 'Recommended Offers',
    subheading: 'Personalised using the customer’s profile and eligibility.',
    summary: [...crossSalesSummary, ...productSummary],
    render: ({ values, setValue, goNext }) => <ProductSelection values={values} setValue={setValue} goNext={goNext} ctx={ctx} variant="buttons" />,
    isValid: (values) => Boolean(values.product) && productEligibilityClear(values),
    // Above the Recommended Offers card: the five ways to start as cards (Offers & Plans). Each does what its footer button does. Not for a line added to a Family Package (a postpaid line).
    aboveCard: ({ values, setValue, goNext }) =>
      values.familyLine || !SHOW_START_CARDS ? null : (
        <Card className="mx-8 mt-8 p-6">
          <h2 className="title title-xl">Offers &amp; Plans</h2>
          <p className="text-secondary mt-1 mb-6">Select the applicable activation journey to view the relevant plans and offers.</p>
          <StartCards values={values} setValue={setValue} goNext={goNext} ctx={ctx} choose={(product) => selectProduct(ctx, values, setValue, product, { advance: true })} />
        </Card>
      ),
    // The footer is the product choice: one button per product, New Postpaid the primary. Each continues in this wizard.
    primaryAction: ({ values, setValue, goNext, defaultButton }) => {
      // A connection added to a Family Package is a postpaid line: no other product to switch to.
      if (values.familyLine) return defaultButton;
      if (!SHOW_FOOTER_JOURNEY_BUTTONS) return <></>;
      const personaId = store.getState().persona.activePersonaId;
      const choose = (product: ConnectionProduct) => {
        // The same product again, with its eligibility already judged: go on (the agent has seen what the step reported).
        if (values.product === product && productEligibilityClear(values)) {
          setValue('productPreselected', false);
          goNext();
          return;
        }
        selectProduct(ctx, values, setValue, product, { advance: true });
      };
      return (
        <div className="journey-bar-slot">
        <div className="journey-bar">
          <div className="journey-bar-heading">
            <span className="eyebrow">Other Options</span>
            <span className="title title-md font-bold">Start Another Journey</span>
          </div>
          {canUseFeature(personaId, HOME_CONNECTION_FEATURE) && (
            <JourneyCardButton label="New Home" hint="Home broadband" tone="amber" icon={ICONS_HOME} onClick={() => handOverHomeToRfs(ctx, values)} />
          )}
          <NewJourneyButtons
            variant="cards"
            // Only the products this role holds a grant for (the journey's own, Postpaid, always stays). New Fixed Line has no button here: New Home covers the home products.
            allowed={(j) => {
              if (j === 'new-fixed-line') return false;
              const product = PRODUCT_OF_OFFER_JOURNEY[j];
              return product ? canStartProduct(personaId, product) : true;
            }}
            onDecline={() => choose('postpaid')}
            // The button's own `goNext` runs one render after onDecline; the step moves on by itself once eligibility is judged.
            goNext={() => {}}
            onHandOff={(route) => {
              // The buttons name a service journey by its route; here that route is just the product it stands for.
              const journey = SERVICE_JOURNEYS.find((j) => j.route === route)?.key;
              const target = journey ? PRODUCT_OF_OFFER_JOURNEY[journey] : undefined;
              if (target) choose(target);
              else if (journey && mnpTypeOfOffer(journey)) choose('mnp');
            }}
          />
        </div>
        </div>
      );
    },
  };
}
