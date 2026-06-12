import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

// Map tool names to the scope required to call them
const TOOL_SCOPES: Record<string, string> = {
  echo: "mcp:tools",
  get_current_time: "time:read",
  generate_uuid: "mcp:tools",
};

export async function authzMcpTools(request: ZuploRequest, context: ZuploContext) {
  const cloned = request.clone();
  const body = await cloned.json() as {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: { name?: string };
  };

  // Only enforce on tool calls
  if (body?.method !== "tools/call") {
    return request;
  }

  const toolName = body?.params?.name;
  const requiredScope = toolName ? TOOL_SCOPES[toolName] : undefined;

  if (!requiredScope) {
    return request;
  }

  const grantedScopes = ((request.user?.data as Record<string, unknown>)?.scope as string ?? "").split(" ");

  if (!grantedScopes.includes(requiredScope)) {
    context.log.warn(JSON.stringify({
      event: "mcp_authz_denied",
      requestId: context.requestId,
      user: { sub: request.user?.sub ?? "anonymous" },
      tool: toolName,
      requiredScope,
      grantedScopes,
    }));

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32001,
          message: `Forbidden: calling '${toolName}' requires scope '${requiredScope}'`,
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return request;
}
