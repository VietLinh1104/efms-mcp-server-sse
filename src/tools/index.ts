import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEfmsTools } from "./efms.js";

export function registerAllTools(server: McpServer) {
  registerEfmsTools(server);
}
