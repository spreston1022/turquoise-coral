import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const TOOL_SCOPES: Record<string, string> = {
  echo: "mcp:tools",
  get_current_time: "time:read",
  generate_uuid: "mcp:tools",
};

// Cached Management API token to avoid fetching on every request
let mgmtTokenCache: { token: string; expiresAt: number } | null = null;

async function getManagementToken(context: ZuploContext): Promise<string> {
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt) {
    context.log.info(JSON.stringify({ event: "mgmt_token_cache_hit" }));
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
  if (!resp.ok) {
    const errBody = await resp.text();
    context.log.warn(JSON.stringify({
      event: "mgmt_token_fetch_failed",
      status: resp.status,
      body: errBody,
    }));
    throw new Error(`Management API token fetch failed: ${resp.status} ${errBody}`);
  }
  const data = await resp.json() as { access_token: string; expires_in: number };
  context.log.info(JSON.stringify({ event: "mgmt_token_fetch_succeeded", expiresIn: data.expires_in }));
  mgmtTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return mgmtTokenCache.token;
}

async function getUserPermissions(userId: string, context: ZuploContext): Promise<string[]> {
  const token = await getManagementToken(context);
  const domain = environment.AUTH0_DOMAIN;
  const url = `https://${domain}/api/v2/users/${encodeURIComponent(userId)}/permissions`;
  context.log.info(JSON.stringify({ event: "mgmt_api_permissions_lookup_started", userId, url }));
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const body = await resp.text();
    context.log.warn(JSON.stringify({
      event: "mgmt_api_permissions_lookup_failed",
      userId,
      status: resp.status,
      body,
    }));
    return [];
  }
  const data = await resp.json() as { permission_name: string }[];
  const permissions = data.map((p) => p.permission_name);
  context.log.info(JSON.stringify({
    event: "mgmt_api_permissions_lookup_succeeded",
    userId,
    permissions,
  }));
  return permissions;
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

  context.log.info(JSON.stringify({
    event: "mcp_authz_check_started",
    requestId: context.requestId,
    tool: toolName,
    requiredScope,
  }));

  // Only call Management API for tools that need more than mcp:tools
  if (!requiredScope || requiredScope === "mcp:tools") {
    context.log.info(JSON.stringify({
      event: "mcp_authz_check_skipped",
      requestId: context.requestId,
      tool: toolName,
      reason: "no elevated scope required",
    }));
    return request;
  }

  // Zuplo sub format: "https://{domain}|{userId}" — extract the Auth0 user ID
  const sub = (request.user?.sub as string) ?? "";
  const parts = sub.split("|");
  const userId = parts.length >= 3
    ? `${parts[parts.length - 2]}|${parts[parts.length - 1]}`
    : sub;

  context.log.info(JSON.stringify({
    event: "mcp_authz_user_resolved",
    requestId: context.requestId,
    sub,
    userId,
  }));

  let permissions: string[] = [];
  try {
    permissions = await getUserPermissions(userId, context);
  } catch (err) {
    context.log.warn(JSON.stringify({
      event: "mcp_authz_permissions_lookup_threw",
      requestId: context.requestId,
      userId,
      error: String(err),
    }));
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

  context.log.info(JSON.stringify({
    event: "mcp_authz_allowed",
    requestId: context.requestId,
    sub,
    tool: toolName,
    requiredScope,
    grantedPermissions: permissions,
  }));

  return request;
}
