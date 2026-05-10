import open from "open";
import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";
import os from "os";

const TOKEN_PATH = path.join(os.homedir(), ".efms-mcp", "token.json");

interface StoredToken {
  accessToken: string;
  companyId: string;
  expiresAt: number; // timestamp ms
}

class TokenManager {
  private cached: StoredToken | null = null;

  async getAuth(): Promise<{ token: string; companyId: string }> {
    // Ưu tiên: memory cache → disk → browser login
    if (this.cached && Date.now() < this.cached.expiresAt - 60_000) {
      return { token: this.cached.accessToken, companyId: this.cached.companyId };
    }
    const disk = this.readDisk();
    if (disk && Date.now() < disk.expiresAt - 60_000) {
      this.cached = disk;
      return { token: disk.accessToken, companyId: disk.companyId };
    }
    const tokenData = await this.browserLogin();
    return { token: tokenData.accessToken, companyId: tokenData.companyId };
  }

  // Deprecated: use getAuth instead
  async getToken(): Promise<string> {
    const auth = await this.getAuth();
    return auth.token;
  }

  private readDisk(): StoredToken | null {
    try {
      if (!fs.existsSync(TOKEN_PATH)) return null;
      return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    } catch {
      return null;
    }
  }

  private save(token: StoredToken) {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    this.cached = token;
  }

  logout() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
      this.cached = null;
    } catch (err) {
      console.error("Lỗi khi đăng xuất:", err);
    }
  }

  private browserLogin(): Promise<StoredToken> {
    return new Promise((resolve, reject) => {
      const port = Number(process.env.EFMS_CALLBACK_PORT ?? 9999);
      const callbackUrl = `http://localhost:${port}/callback`;
      const loginUrl = `${process.env.EFMS_AUTH_URL}?redirect_uri=${encodeURIComponent(callbackUrl)}`;

      const server = http.createServer((req, res) => {
        try {
          const url = new URL(req.url!, `http://localhost:${port}`);
          if (url.pathname !== "/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const token = url.searchParams.get("token");
          const companyId = url.searchParams.get("company_id") || "";
          const expiresIn = Number(url.searchParams.get("expires_in") ?? 3600);

          if (!token) {
            res.writeHead(400);
            res.end("Lỗi: không nhận được token.");
            return reject(new Error("No token in callback"));
          }

          const tokenData: StoredToken = {
            accessToken: token,
            companyId: companyId,
            expiresAt: Date.now() + expiresIn * 1000,
          };

          this.save(tokenData);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Đăng nhập thành công | EFMS</title>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
              <style>
                :root {
                  --primary: #0f172a;
                  --success: #10b981;
                  --bg: #f8fafc;
                }
                body {
                  margin: 0;
                  padding: 0;
                  font-family: 'Inter', sans-serif;
                  background-color: var(--bg);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  color: var(--primary);
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 3rem;
                  border-radius: 2rem;
                  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                  max-width: 400px;
                  width: 90%;
                  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .icon-wrapper {
                  width: 80px;
                  height: 80px;
                  background: #ecfdf5;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 1.5rem;
                  position: relative;
                }
                .icon-wrapper::after {
                  content: '';
                  position: absolute;
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  border: 2px solid var(--success);
                  animation: pulse 2s infinite;
                }
                @keyframes pulse {
                  0% { transform: scale(1); opacity: 0.5; }
                  100% { transform: scale(1.5); opacity: 0; }
                }
                svg {
                  width: 40px;
                  height: 40px;
                  color: var(--success);
                }
                h1 {
                  font-size: 1.5rem;
                  font-weight: 700;
                  margin-bottom: 0.5rem;
                  letter-spacing: -0.025em;
                }
                p {
                  color: #64748b;
                  line-height: 1.6;
                  margin-bottom: 2rem;
                }
                .badge {
                  display: inline-block;
                  padding: 0.5rem 1rem;
                  background: #f1f5f9;
                  border-radius: 9999px;
                  font-size: 0.875rem;
                  font-weight: 600;
                  color: #475569;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1>Đăng nhập thành công!</h1>
                <p>Xác thực hoàn tất. Bạn đã có thể quay lại IDE để tiếp tục làm việc.</p>
                <div class="badge">An toàn để đóng tab này</div>
              </div>
            </body>
            </html>
          `);

          // Close server after a short delay to allow response to be sent
          setTimeout(() => server.close(), 1000);
          resolve(tokenData);
        } catch (err) {
          res.writeHead(500);
          res.end("Internal Server Error");
          reject(err);
        }
      });

      server.listen(port, () => {
        console.error(`Đang mở trình duyệt để đăng nhập: ${loginUrl}`);
        open(loginUrl).catch((err) => {
          console.error("Không thể mở trình duyệt tự động:", err);
          console.error(`Vui lòng mở URL sau thủ công: ${loginUrl}`);
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("Login timeout"));
      }, 300_000);
    });
  }
}

export const tokenManager = new TokenManager();
