export { evaluateEligibility, evaluateCart, validateRequest, resolveSegment, countLines } from './engine';
export { ruleConfigV1 } from './config/eligibility.rules.v1';
export { validateRuleConfig, assertValidRuleConfig } from './config/schema';
export { REASON } from './reasonCodes';
export type * from './types';
export { connectionLimitReport } from './connectionLimits';
export type { ConnectionLimit, ConnectionLimitReport, LimitLevel, LimitedConnection } from './connectionLimits';
