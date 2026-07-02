import { ZuploRequest, ZuploContext } from "@zuplo/runtime";

const catalog = {
  specVersion: "1.0",
  host: {
    displayName: "Turquoise Coral",
    // This did:web has to match the domain serving the file. That match is what proves the catalog is yours.
    identifier: "did:web:turquoise-coral-main-88d11f0.zuplo.app",
  },
  entries: [
    {
      identifier: "urn:air:turquoise-coral-main-88d11f0.zuplo.app:server:demo-mcp-server",
      displayName: "Demo MCP Server",
      type: "application/mcp-server+json",
      // The /mcp endpoint our Zuplo project already exposes.
      url: "https://turquoise-coral-main-88d11f0.zuplo.app/mcp",
      capabilities: ["echo", "get_current_time", "generate_uuid"],
      description:
        "Demo MCP server exposing basic utility tools (echo, current time, UUID generation) behind Zuplo's MCP Gateway.",
      representativeQueries: [
        "echo back this message",
        "what time is it",
        "generate a random uuid",
      ],
    },
  ],
};

export async function handleWellKnown(
  _request: ZuploRequest,
  _context: ZuploContext,
): Promise<Response> {
  // Pretty-print it so the catalog is readable if someone fetches it in a browser.
  return new Response(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
