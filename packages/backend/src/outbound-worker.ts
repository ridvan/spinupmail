import {
  handleAgentOutboundQueueBatch,
  recoverAgentSubmissions,
  type AgentOutboundQueueMessage,
} from "./modules/agent-api/sending";

export default {
  queue: (
    batch: MessageBatch<AgentOutboundQueueMessage>,
    env: CloudflareBindings
  ) => handleAgentOutboundQueueBatch({ batch, env }),
  scheduled: (
    _controller: ScheduledController,
    env: CloudflareBindings,
    ctx: ExecutionContext
  ) => ctx.waitUntil(recoverAgentSubmissions(env)),
};
