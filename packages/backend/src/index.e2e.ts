import {
  createWorkerHandler,
  FixedWindowRateLimiterDurableObject,
  InboundAbuseCounterDurableObject,
} from "./index";

export default createWorkerHandler({
  includeE2ETestRoutes: true,
});

export {
  FixedWindowRateLimiterDurableObject,
  InboundAbuseCounterDurableObject,
};
