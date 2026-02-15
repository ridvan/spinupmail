export const readJsonBody = async <T>(c: {
  req: { json: () => Promise<unknown> };
}) => {
  try {
    return (await c.req.json()) as T;
  } catch {
    return {} as T;
  }
};

export const getClientIp = (request: Request) => {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
};
