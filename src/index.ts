console.log = console.error;

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./tools/index.js";
import { randomUUID } from "crypto";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const baseUrl = process.env.EFMS_BASE_URL || "http://localhost:8080";
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
  res.status(200).json({ name: "efms-mcp-server", version: "1.0.0" });
});

app.post("/mcp", async (req, res) => {
  const authHeader = req.headers.authorization;
  console.error(`[MCP] 📥 POST /mcp`);
  console.error(`[MCP] 🔑 Authorization: ${authHeader ? "Đã gửi" : "Trống"}`);

  if (!authHeader?.startsWith("Bearer ")) {
    console.error(`[MCP] ❌ Thiếu token`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const identityRes = await axios.get(
      `${process.env.EFMS_BASE_URL}/api/identity/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const user = identityRes.data.data;
    console.error(`[MCP] 👤 User: ${user?.email}, companyId: ${user?.companyId}`);

    if (!user?.companyId) {
      console.error(`[MCP] ❌ Thiếu companyId`);
      return res.status(400).json({ error: "Missing companyId" });
    }

    const server = new McpServer({ name: "efms-mcp-server", version: "1.0.0" });

    console.error(`[MCP] 🔧 Đang register tools...`);
    registerAllTools(server, { token, companyId: user.companyId });
    console.error(`[MCP] ✅ Register tools thành công`);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });

    await (server as any).connect(transport);
    await transport.handleRequest(req, res, req.body);
    console.error(`[MCP] ✅ Request handled`);

  } catch (err: any) {
    console.error(`[MCP] ❌ Lỗi: ${err.message}`);
    if (err.response) {
      console.error(`[MCP] Chi tiết: ${JSON.stringify(err.response.data)}`);
    }
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`EFMS MCP Server running on port ${port}`);
});