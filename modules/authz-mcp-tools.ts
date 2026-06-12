import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

// Map tool names to the scope required to call them
const TOOL_SCOPES: Record<string, string> = {
  echo: "mcp:tools",
  get_current_time: "time:read",
  generate_uuid: "mcp:tools",
};

export async function authzMcpTools(request: ZuploRequest, context: ZuploContext) {
  // GET requests (SSE stream) have no body — skip
  if (request.method !== "POST") {
    return request;
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string } };
  try {
    body = await request.clone().json();
  } catch {
    return request;
  }

  // Only enforce on tool calls
  if (body?.method !== "tools/call") {
    return request;
  }

  const toolName = body?.params?.name;
  const requiredScope = toolName ? TOOL_SCOPES[toolName] : undefined;

  if (!requiredScope) {
    return request;
  }

  const data = request.user?.data as Record<string, unknown> | undefined;
  const scopeStr = (data?.scope as string ?? "").split(" ");
  const permissions = (data?.permissions as string[] | undefined) ?? [];
  const grantedScopes = [...new Set([...scopeStr, ...permissions])];

  if (!grantedScopes.includes(requiredScope)) {
    context.log.warn(JSON.stringify({
      event: "mcp_authz_denied",
      requestId: context.requestId,
      user: { sub: request.user?.sub ?? "anonymous" },
      tool: toolName,
      requiredScope,
      grantedScopes,
    }));

    // Return HTTP 200 with a JSON-RPC error — HTTP 4xx causes clients to re-authenticate
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32001,
          message: `Forbidden: calling '${toolName}' requires scope '${requiredScope}'`,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return request;
}
