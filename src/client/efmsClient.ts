import axios from "axios";

export const createEfmsClient = (token: string, companyId?: string) => {
  const client = axios.create({
    baseURL: process.env.EFMS_BASE_URL || "",
    timeout: 15_000,
  });

  client.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${token}`;
    if (companyId) {
      config.headers["X-Company-Id"] = companyId;
    }
    return config;
  });

  return client;
};
