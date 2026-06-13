import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export async function logMcpRequest(request: ZuploRequest, context: ZuploContext) {
  try {
    const cloned = request.clone();
    const body = await cloned.json() as { method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };

    const sessionId = request.headers.get('mcp-session-id') ?? null;
    const sub = (request.user?.sub as string) ?? "anonymous";
    const data = request.user?.data as Record<string, unknown> | undefined;
    const scope = (data?.scope as string) ?? null;
    const clientId = (data?.clientId as string) ?? null;
    const grantId = (data?.grantId as string) ?? null;

    const method = body?.method ?? "unknown";
    const toolName = body?.params?.name ?? null;
    const toolArgs = body?.params?.arguments ?? null;

    context.log.info(JSON.stringify({
      event: "mcp_request",
      requestId: context.requestId,
      session: sessionId,
      user: { sub, scope, clientId, grantId },
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
