import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

export async function logUpstreamUrl(request: ZuploRequest, context: ZuploContext) {
  context.log.info(`MCP_UPSTREAM_URL resolved: ${environment.MCP_UPSTREAM_URL}`);
  return request;
}
