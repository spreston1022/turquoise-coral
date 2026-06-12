import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export async function logMcpRequest(request: ZuploRequest, context: ZuploContext) {
  try {
    const cloned = request.clone();
    const body = await cloned.json() as { method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };

    const sessionId = request.headers.get('mcp-session-id') ?? null;

    // request.user is populated by mcp-auth0-oauth-inbound after token validation
    const sub = (request.user?.sub as string) ?? "anonymous";
    const email = (request.user?.data?.["https://zuplo.com/email"] as string) ?? null;
    context.log.debug(`user.data: ${JSON.stringify(request.user?.data)}`);

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
