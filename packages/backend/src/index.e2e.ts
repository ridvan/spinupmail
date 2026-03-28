import { createWorkerHandler, InboundAbuseCounterDurableObject } from "./index";

export default createWorkerHandler({
  includeE2ETestRoutes: true,
});

export { InboundAbuseCounterDurableObject };
