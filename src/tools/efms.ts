import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { efmsClient } from "../client/efmsClient.js";
import { tokenManager } from "../auth/tokenManager.js";
import fs from "fs";

const LOG_FILE = "/tmp/efms-mcp.log";
function log(msg: string) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

export function registerEfmsTools(server: McpServer) {
  const handleError = (error: any) => {
    log(`ERROR: ${error.message} | Status: ${error.response?.status} | URL: ${error.config?.url}`);
    return {
      content: [
        { 
          type: "text" as const, 
          text: `Lỗi API: ${error.message} (Status: ${error.response?.status})\nResponse: ${JSON.stringify(error.response?.data || "No data")}` 
        }
      ],
      isError: true,
    };
  };

  server.tool("check_connection", "Kiểm tra kết nối", {}, async () => {
    return { content: [{ type: "text" as const, text: "Kết nối ổn định!" }] };
  });

  server.tool(
    "list_invoices",
    "Liệt kê danh sách hóa đơn",
    {
      status: z.string().optional(),
      invoiceType: z.string().optional(),
      partnerId: z.string().optional(),
      page: z.number().default(0),
      size: z.number().default(20),
    },
    async (params) => {
      try {
        const auth = await tokenManager.getAuth();
        const response = await efmsClient.get("/api/core/v1/invoices", { 
          params: { ...params, companyId: auth.companyId } 
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response.data.data, null, 2) }],
        };
      } catch (error: any) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_invoice_details",
    "Lấy chi tiết hóa đơn",
    { id: z.string() },
    async ({ id }) => {
      try {
        const response = await efmsClient.get(`/api/core/v1/invoices/${id}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response.data.data, null, 2) }],
        };
      } catch (error: any) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "list_partners",
    "Tìm kiếm đối tác",
    {
      search: z.string().optional(),
      type: z.string().optional(),
      page: z.number().default(0),
      size: z.number().default(20),
    },
    async (params) => {
      try {
        const auth = await tokenManager.getAuth();
        const response = await efmsClient.get("/api/core/v1/partners", { 
          params: { ...params, companyId: auth.companyId } 
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response.data.data, null, 2) }],
        };
      } catch (error: any) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "list_pending_tasks",
    "Liệt kê công việc chờ phê duyệt",
    {
      page: z.number().default(0),
      size: z.number().default(20),
    },
    async (params) => {
      try {
        const response = await efmsClient.get("/api/core/v1/approval/tasks", { params });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response.data.data, null, 2) }],
        };
      } catch (error: any) {
        return handleError(error);
      }
    }
  );
  server.tool(
    "logout",
    "Đăng xuất tài khoản EFMS",
    {},
    async () => {
      tokenManager.logout();
      return {
        content: [{ type: "text" as const, text: "Đã đăng xuất thành công. Phiên làm việc đã được xóa." }],
      };
    }
  );
}
