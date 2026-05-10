import axios from "axios";
import { tokenManager } from "../auth/tokenManager.js";

export const efmsClient = axios.create({
  baseURL: process.env.EFMS_BASE_URL || "",
  timeout: 15_000,
});

efmsClient.interceptors.request.use(async (config) => {
  const auth = await tokenManager.getAuth();
  config.headers.Authorization = `Bearer ${auth.token}`;
  
  if (auth.companyId) {
    config.headers["X-Company-Id"] = auth.companyId;
  }

  return config;
});
