// Real records from public/mock-data (products.json, addons-discounts.json, recharge-products.json), copied field for field, for the stories of components
// that take plain props. Nothing here is invented: each entry keeps the id and values of the catalogue record it came from.
import type { Discount, PostpaidPlan } from '../../src/components/patterns/postpaidPlanModel';
import type { PrepaidPlan } from '../../src/components/patterns/prepaidPlanModel';
import type { PricingRecharge } from '../../src/components/patterns/prepaidCartModel';

/** PROD-107: a Voice plan on the Offers tab, Popular, with a promotional price. */
export const ESSENTIAL: PostpaidPlan = {
  productId: 'PROD-107',
  name: 'Postpaid Essential',
  type: 'Postpaid Plan',
  mrcQAR: 115,
  originalMrcQAR: 130,
  promoMonths: 4,
  dataAllowanceGB: 15,
  minutesAllowance: '500 local minutes',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  popular: true,
  offer: true,
  features: ['15GB full speed local data', '500 local minutes', '300 SMS', 'Up to 300 international minutes'],
  fup: [
    'First 15 GB is at full 5G speed and then unlimited data at the speed of 128 Kbps.',
    'QR 15 Discount on plan fee will be applicable for first 4 months',
    'This promo is valid starting from 2 August 2026 till 3 November 2026.',
  ],
  benefits: ['Free Star Number worth QAR 1,500', 'Free Vodafone My Book'],
  planClass: 'Postpaid Voice Plans',
};

/** PROD-111: a Broadband plan with unlimited data (dataAllowanceGB is null). */
export const UNLIMITED: PostpaidPlan = {
  productId: 'PROD-111',
  name: 'Postpaid Unlimited',
  type: 'Postpaid Plan',
  mrcQAR: 225,
  originalMrcQAR: 300,
  promoMonths: 6,
  dataAllowanceGB: null,
  minutesAllowance: 'Unlimited local',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  offer: true,
  features: ['Unlimited local data', 'Unlimited local minutes & SMS', '200 international minutes', 'International Call Block free for the first 6 months', 'Roaming: 15GB data and unlimited roaming minutes with Call+'],
  benefits: ['Free Star Number worth QAR 5,000', 'Free Vodafone My Book', 'Vodafone Call+', 'Vodafone World worth up to QAR 30'],
  planClass: 'Postpaid Broadband Plans',
};

/** PROD-142: a Family plan. */
export const AHLI_MEMBER: PostpaidPlan = {
  productId: 'PROD-142',
  name: 'Postpaid Ahli Member Promotion',
  type: 'Postpaid Plan',
  mrcQAR: 375,
  originalMrcQAR: 399,
  promoMonths: 3,
  dataAllowanceGB: 50,
  minutesAllowance: 'Unlimited local minutes',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  offer: true,
  features: ['50GB full speed local data', 'Unlimited local minutes & SMS', 'Up to 300 international minutes'],
  fup: ['1 Mbps endless internet after 50GB'],
  benefits: ['Star Number worth QAR 3,500', 'Free Vodafone My Book', '1000 Welcome iPoints', 'Vodafone World worth up to QAR 10 every month per line'],
  planClass: 'Postpaid Family Plans',
};

/** PROD-100: a pre-bundled offer (no `features`, so the card derives its rows from the allowance fields). */
export const PRE_BUNDLED: PostpaidPlan = {
  productId: 'PROD-100',
  name: 'Postpaid Extra Promotion',
  type: 'Postpaid Plan',
  mrcQAR: 250,
  dataAllowanceGB: 30,
  minutesAllowance: 'Unlimited local',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  listed: false,
  benefits: ['Free 10GB roaming data', 'Free caller tune'],
  preBundledOffer: true,
  planClass: 'Postpaid Voice Plans',
};

/** PROD-113: a high-priced Voice plan with several benefits. */
export const PLATINUM: PostpaidPlan = {
  productId: 'PROD-113',
  name: 'Postpaid Unlimited Platinum',
  type: 'Postpaid Plan',
  mrcQAR: 650,
  originalMrcQAR: 750,
  promoMonths: 6,
  dataAllowanceGB: null,
  minutesAllowance: 'Unlimited local',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  features: ['Unlimited local data', 'Unlimited local minutes & SMS', '400 international minutes', 'Roaming: 300 minutes & SMS and 50GB data'],
  benefits: ['Free Star Number worth QAR 20,000', 'VIP Valet', 'Free Vodafone My Book', 'Vodafone World worth up to QAR 100'],
  planClass: 'Postpaid Voice Plans',
};

/** PROD-130: a nationality promotion (offered only to Indian customers). */
export const INDIA_PROMOTION: PostpaidPlan = {
  productId: 'PROD-130',
  name: 'Postpaid Plus Essential India Promotion',
  type: 'Postpaid Plan',
  mrcQAR: 115,
  dataAllowanceGB: 15,
  minutesAllowance: '500 local minutes',
  speedTier: '5G Ready',
  commitmentMonths: 3,
  features: ['15GB full speed local data', '500 local minutes', '300 SMS', '300 international minutes'],
  planClass: 'Postpaid Voice Plans',
  eligibleNationalities: ['Indian'],
};

/** A set of real plans in catalogue order, for grids and search. */
export const POSTPAID_PLANS: PostpaidPlan[] = [ESSENTIAL, UNLIMITED, AHLI_MEMBER, PRE_BUNDLED, PLATINUM, INDIA_PROMOTION];

/** PROD-300 .. PROD-304: the prepaid starter packs. */
export const PREPAID_STANDARD_SIM: PrepaidPlan = { productId: 'PROD-300', name: 'New Prepaid Standard SIM', type: 'Prepaid Plan', starterPackChargeQAR: 0, dataAllowanceGB: null, minutesAllowance: 'Pay as you go', packValidityDays: null };
export const PREPAID_RED_25: PrepaidPlan = { productId: 'PROD-301', name: 'Prepaid Red 25', type: 'Prepaid Plan', starterPackChargeQAR: 25, dataAllowanceGB: 5, minutesAllowance: '100 local minutes', packValidityDays: 30 };
export const PREPAID_RED_50: PrepaidPlan = { productId: 'PROD-302', name: 'Prepaid Red 50', type: 'Prepaid Plan', starterPackChargeQAR: 50, dataAllowanceGB: 15, minutesAllowance: '300 local minutes', packValidityDays: 30, popular: true };
export const PREPAID_PREMIUM_150: PrepaidPlan = { productId: 'PROD-304', name: 'Prepaid Premium 150', type: 'Prepaid Plan', starterPackChargeQAR: 150, dataAllowanceGB: 80, minutesAllowance: 'Unlimited local', packValidityDays: 30, eligibleSegments: ['Premium'] };
export const PREPAID_PACKS: PrepaidPlan[] = [PREPAID_STANDARD_SIM, PREPAID_RED_25, PREPAID_RED_50, PREPAID_PREMIUM_150];

/** Plan discounts from addons-discounts.json. A discount's `price` is a negative fraction (-0.25 = 25% off). */
export const DISCOUNTS: Discount[] = [
  { addonDiscountId: 'ADO-7400', addonType: 'Promotional Discount', name: '10% Discount', description: '10% off the monthly plan fee', price: -0.1, category: 'Discount', durationMonths: 6, planId: 'PROD-110' },
  { addonDiscountId: 'ADO-7103', addonType: 'Loyalty Discount', name: '6 Month Retention Discount', description: '15% discount for retained customers', price: -0.15, category: 'Discount', durationMonths: 6, planId: 'PROD-201' },
  { addonDiscountId: 'ADO-7112', addonType: 'MADA Discount', name: 'MADA Discount', description: 'MADA cardholders receive a 25% discount on the plan rental every month.', price: -0.25, category: 'Discount', durationMonths: 6, planId: 'PROD-104' },
];

/** RCH-CMBP-040: a recharge whose button reads "View eligible countries" (minutes only). */
export const RECHARGE_COMBO_40: PricingRecharge = {
  rechargeId: 'RCH-CMBP-040',
  name: 'Combo+ 40',
  category: 'Combo+',
  amountQar: 40,
  validity: '28 days',
  benefits: [
    { text: '4 GB Data', kind: 'data' },
    { text: '150 Local Minutes', kind: 'voice' },
    { text: '10 Intl Mins', kind: 'international' },
  ],
  countryInfo: {
    button: 'View eligible countries',
    minutes: '10 International Minutes to the countries below',
    countries: ['Egypt', 'India', 'Philippines', 'Sri Lanka', 'Thailand', 'Pakistan', 'Saudi Arabia', 'U.A.E.', 'Bangladesh', 'Bahrain', 'Turkey', 'Indonesia', 'Nepal', 'Sudan'],
  },
  status: 'Active',
};

/** RCH-CMBP-050: a recharge whose button reads "View Country Bonus" (minutes plus a bonus table). */
export const RECHARGE_COMBO_50: PricingRecharge = {
  rechargeId: 'RCH-CMBP-050',
  name: 'Combo+ 50',
  category: 'Combo+',
  amountQar: 50,
  validity: '28 days',
  benefits: [
    { text: '5 GB Data', kind: 'data' },
    { text: '200 Local Minutes', kind: 'voice' },
    { text: '10 Intl Mins + Bonus', kind: 'international' },
  ],
  passes: {
    title: 'Includes 1 Free Pass',
    items: [
      { text: '4 GB Night Data (10PM to 5AM)', kind: 'night' },
      { text: '2 GB Social Media Data', kind: 'data' },
      { text: '200 mins Local Minute Pass', kind: 'voice' },
    ],
  },
  countryInfo: {
    button: 'View Country Bonus',
    minutes: '10 International Minutes to the countries below',
    countries: ['Egypt', 'India', 'Philippines', 'Sri Lanka', 'Thailand', 'Pakistan', 'Saudi Arabia', 'U.A.E.', 'Bangladesh', 'Bahrain', 'Turkey', 'Indonesia', 'Nepal', 'Sudan'],
    bonus: {
      heading: 'Bonus to 6 countries',
      rows: [
        { iso: 'IN', country: 'India', bonus: '45 mins' },
        { iso: 'PK', country: 'Pakistan', bonus: '10 mins' },
        { iso: 'NP', country: 'Nepal', bonus: '10 mins' },
        { iso: 'BD', country: 'Bangladesh', bonus: '25 mins' },
        { iso: 'PH', country: 'Philippines', bonus: '25 mins to Philippines globe' },
        { iso: 'ID', country: 'Indonesia', bonus: '16 mins' },
      ],
    },
  },
  status: 'Active',
};
