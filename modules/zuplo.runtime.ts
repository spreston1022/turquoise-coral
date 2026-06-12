import { RuntimeExtensions } from "@zuplo/runtime";
import { McpGatewayPlugin } from "@zuplo/runtime/mcp-gateway";

export function runtimeInit(runtime: RuntimeExtensions) {
  runtime.addPlugin(new McpGatewayPlugin());
}
