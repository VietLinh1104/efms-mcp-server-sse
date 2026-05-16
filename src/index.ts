console.log = console.error;

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./tools/index.js";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const baseUrl = process.env.PUBLIC_EFMS_BASE_URL || "http://localhost:8080";
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/identity/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/identity/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["openid", "profile", "email"]
  });
});

app.get("/mcp", (req, res) => {
  res.json({ name: "efms-mcp-server", version: "1.0.0" });
});

app.post("/mcp", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    console.error(`[MCP] ❌ Thiếu token từ IP: ${req.ip}. Headers:`, req.headers);
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7).trim();

  try {
    const identityRes = await axios.get(
      `${process.env.PUBLIC_EFMS_BASE_URL}/api/identity/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const user = identityRes.data.data;
    if (!user?.companyId) {
      return res.status(400).json({ error: "Missing companyId" });
    }

    console.error(`[MCP] 👤 ${user.email} | ${req.body?.method}`);

    const server = new McpServer({ name: "efms-mcp-server", version: "1.0.0" });
    registerAllTools(server, { token, companyId: user.companyId });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    } as any);

    await server.connect(transport as any);
    await transport.handleRequest(req, res, req.body);

  } catch (error: any) {
    console.error(`[MCP] ❌ ${error.message}`);
    if (!res.headersSent) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  }
});

app.get("/", (req, res) => res.redirect("/mcp"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`EFMS MCP Server running on port ${port}`);
});