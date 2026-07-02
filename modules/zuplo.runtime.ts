import { RuntimeExtensions } from "@zuplo/runtime";
import { McpGatewayPlugin } from "@zuplo/runtime/mcp-gateway";
import { OpenTelemetryPlugin } from "@zuplo/otel";

export function runtimeInit(runtime: RuntimeExtensions) {
  runtime.addPlugin(new McpGatewayPlugin());
  runtime.addPlugin(new OpenTelemetryPlugin());
}
