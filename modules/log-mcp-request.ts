import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export async function logMcpRequest(request: ZuploRequest, context: ZuploContext) {
  try {
    const cloned = request.clone();
    const body = await cloned.json() as { method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };

    const user = context.user;
    const method = body?.method ?? "unknown";
    const toolName = body?.params?.name ?? null;
    const toolArgs = body?.params?.arguments ?? null;

    context.log.info(JSON.stringify({
      event: "mcp_request",
      requestId: context.requestId,
      user: {
        sub: user?.sub ?? "anonymous",
        email: (user?.data as Record<string, unknown>)?.email ?? null,
      },
      mcp: {
        method,
        ...(toolName ? { tool: toolName } : {}),
        ...(toolArgs ? { args: toolArgs } : {}),
      },
      timestamp: new Date().toISOString(),
    }));
  } catch {
    // non-JSON body (e.g. GET requests) — skip logging
  }

  return request;
}
