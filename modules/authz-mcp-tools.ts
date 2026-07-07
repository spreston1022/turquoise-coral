import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const TOOL_SCOPES: Record<string, string> = {
  echo: "mcp:tools",
  get_current_time: "time:read",
  generate_uuid: "mcp:tools",
};

// Cached Management API token to avoid fetching on every request
let mgmtTokenCache: { token: string; expiresAt: number } | null = null;

async function getManagementToken(): Promise<string> {
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt) {
    return mgmtTokenCache.token;
  }
  const domain = environment.AUTH0_DOMAIN;
  const resp = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: environment.AUTH0_MGMT_CLIENT_ID,
      client_secret: environment.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  const data = await resp.json() as { access_token: string; expires_in: number };
  mgmtTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return mgmtTokenCache.token;
}

async function getUserPermissions(userId: string): Promise<string[]> {
  const token = await getManagementToken();
  const domain = environment.AUTH0_DOMAIN;
  const resp = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(userId)}/permissions`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return [];
  const data = await resp.json() as { permission_name: string }[];
  return data.map((p) => p.permission_name);
}

export async function authzMcpTools(request: ZuploRequest, context: ZuploContext) {
  if (request.method !== "POST") return request;

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string } };
  try {
    body = await request.clone().json();
  } catch {
    return request;
  }

  if (body?.method !== "tools/call") return request;

  const toolName = body?.params?.name;
  const requiredScope = toolName ? TOOL_SCOPES[toolName] : undefined;

  // Only call Management API for tools that need more than mcp:tools
  if (!requiredScope || requiredScope === "mcp:tools") return request;

  // Zuplo sub format: "https://{domain}|{userId}" — extract the Auth0 user ID
  const sub = (request.user?.sub as string) ?? "";
  const parts = sub.split("|");
  const userId = parts.length >= 3
    ? `${parts[parts.length - 2]}|${parts[parts.length - 1]}`
    : sub;

  let permissions: string[] = [];
  try {
    permissions = await getUserPermissions(userId);
  } catch (err) {
    context.log.warn(`authz-mcp-tools: management API call failed: ${err}`);
  }

  if (!permissions.includes(requiredScope)) {
    context.log.warn(JSON.stringify({
      event: "mcp_authz_denied",
      requestId: context.requestId,
      user: { sub },
      tool: toolName,
      requiredScope,
      grantedPermissions: permissions,
    }));

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `Permission denied: the '${toolName}' tool requires the '${requiredScope}' scope, which is not included in your current authorization. This is a permissions/scope issue, not a transient error — ask your administrator to grant the '${requiredScope}' permission to retry.`,
            },
          ],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return request;
}
