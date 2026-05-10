import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { efmsClient } from "../client/efmsClient.js";

export function registerDemoTools(server: McpServer) {
  server.tool(
    "demo_list_invoices",
    "Demo: Lấy danh sách invoice từ EFMS (chỉ dùng để test kết nối)",
    {
      page: z.number().default(0).describe("Số trang"),
      size: z.number().default(5).describe("Số lượng bản ghi mỗi trang"),
    },
    async ({ page, size }) => {
      try {
        const res = await efmsClient.get("/api/core/v1/invoices", {
          params: { page, size },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Lỗi khi gọi EFMS API: ${error.message}${
                error.response ? `\nChi tiết: ${JSON.stringify(error.response.data)}` : ""
              }`,
            },
          ],
        };
      }
    }
  );
}
