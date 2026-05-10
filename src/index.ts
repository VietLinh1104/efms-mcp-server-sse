import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const LOG_FILE = "/tmp/efms-mcp-debug.log";
function log(msg: string) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

log("Starting EFMS MCP Server...");

// Redirect all stdout to stderr to avoid breaking MCP protocol
console.log = console.error;

dotenv.config();

const server = new McpServer({
  name: "efms-mcp-server",
  version: "1.0.0",
});

registerAllTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("EFMS MCP Server running on stdio");
}

main().catch((error) => {
  log(`Fatal error in main(): ${error.stack || error}`);
  console.error("Fatal error in main():", error);
  process.exit(1);
});
