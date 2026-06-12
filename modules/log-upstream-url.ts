import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export async function logUpstreamUrl(request: ZuploRequest, context: ZuploContext) {
  context.log.info(`MCP_UPSTREAM_URL resolved: ${process.env.MCP_UPSTREAM_URL}`);
  return request;
}
