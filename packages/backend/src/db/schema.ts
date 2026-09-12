import * as authSchema from "./auth.schema"; // This will be generated in a later step
import * as agentSchema from "./agent.schema";
import * as emailSchema from "./email.schema";
import * as integrationSchema from "./integration.schema";
import * as operationalEventSchema from "./operational-event.schema";

// Combine all schemas here for migrations
export const schema = {
  ...authSchema,
  ...agentSchema,
  ...emailSchema,
  ...integrationSchema,
  ...operationalEventSchema,
  // ... your other application schemas
} as const;
