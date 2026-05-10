// Redirect all stdout to stderr to avoid breaking MCP protocol if run via stdio
console.log = console.error;

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./tools/index.js";
import type { McpContext } from "./tools/efms.js";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Metadata OAuth cho MCP Client
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const baseUrl = process.env.EFMS_BASE_URL || "http://localhost:8080";
  const authUrl = process.env.EFMS_AUTH_URL || "http://localhost:5173/login";

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

// Lưu trữ các transport theo session để handle message POST
const transports = new Map<string, SSEServerTransport>();

const sseHandler = async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  
  console.error(`[SSE] 📥 Request tới: ${req.path}`);
  console.error(`[SSE] 🔑 Authorization: ${authHeader ? "Đã gửi" : "Trống"}`);

  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[SSE] ❌ Thiếu hoặc sai định dạng Token");
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Vui lòng kết nối qua Claude và thực hiện xác thực OAuth." 
    });
  }

  const token = authHeader.slice(7);
  const identityUrl = `${process.env.EFMS_BASE_URL || "http://localhost:8080"}/api/identity/auth/me`;
  
  console.error(`[SSE] 🔍 Đang xác thực token tại: ${identityUrl}`);

  try {
    const identityRes = await axios.get(identityUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.error("[SSE] ✅ Xác thực thành công");
    const user = identityRes.data.data;

    const server = new McpServer({
      name: "efms-mcp-server",
      version: "1.0.0",
    });

    registerAllTools(server, {
      token,
      companyId: user.companyId
    });

    // Post message endpoint vẫn là /messages
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    console.error(`[SSE] 🚀 Đã tạo session: ${sessionId}`);
    await server.connect(transport);

    res.on("close", () => {
      console.error(`[SSE] 🔌 Đã đóng session: ${sessionId}`);
      transports.delete(sessionId);
    });

  } catch (error: any) {
    console.error(`[SSE] ❌ Lỗi kết nối: ${error.message}`);
    if (error.response) {
      console.error(`[SSE] Chi tiết lỗi API: ${JSON.stringify(error.response.data)}`);
    }
    return res.status(401).json({ error: "Unauthorized / Connection failed" });
  }
};

app.get("/", sseHandler);
app.get("/sse", sseHandler);

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }

  await transport.handlePostMessage(req, res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`EFMS MCP Server (HTTP/SSE) running on port ${port}`);
});
