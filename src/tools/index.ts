import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEfmsTools, type McpContext } from "./efms.js";

export function registerAllTools(server: McpServer, ctx: McpContext) {
  registerEfmsTools(server, ctx);
}
