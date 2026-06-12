import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export async function logMcpRequest(request: ZuploRequest, context: ZuploContext) {
  try {
    const cloned = request.clone();
    const body = await cloned.json() as { method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };

    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const claims = token ? decodeJwtPayload(token) : null;
    const sub = (claims?.sub as string) ?? "anonymous";
    const email = (claims?.email as string) ?? null;
    const sessionId = request.headers.get('mcp-session-id') ?? null;

    // Dump all incoming headers to identify where identity information lives
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => { allHeaders[key] = value; });
    context.log.debug(`mcp-request headers: ${JSON.stringify(allHeaders)}`);

    const method = body?.method ?? "unknown";
    const toolName = body?.params?.name ?? null;
    const toolArgs = body?.params?.arguments ?? null;

    context.log.info(JSON.stringify({
      event: "mcp_request",
      requestId: context.requestId,
      session: sessionId,
      user: { sub, email },
      mcp: {
        method,
        ...(toolName ? { tool: toolName } : {}),
        ...(toolArgs ? { args: toolArgs } : {}),
      },
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    context.log.warn(`log-mcp-request failed: ${err}`);
  }

  return request;
}
