import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (email: string, password: string, full_name?: string) =>
    api.post("/auth/register", { email, password, full_name }).then((r) => r.data),
  login: (email: string, password: string) => {
    const form = new FormData();
    form.append("username", email);
    form.append("password", password);
    return api.post("/auth/login", form).then((r) => r.data);
  },
};

export const portfolioAPI = {
  list:   () => api.get("/portfolio/").then((r) => r.data),
  create: (name: string, broker?: string) =>
    api.post("/portfolio/", null, { params: { name, broker } }).then((r) => r.data),
  addHolding: (portfolioId: number, holding: any) =>
    api.post(`/portfolio/${portfolioId}/holdings`, holding).then((r) => r.data),
  updateHolding: (portfolioId: number, holdingId: number, data: any) =>
    api.put(`/portfolio/${portfolioId}/holdings/${holdingId}`, data).then((r) => r.data),
  deleteHolding: (portfolioId: number, holdingId: number) =>
    api.delete(`/portfolio/${portfolioId}/holdings/${holdingId}`),
  uploadCSV: (portfolioId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/upload/${portfolioId}/csv`, form).then((r) => r.data);
  },
};

export const taxAPI = {
  summary:  (portfolioId: number, asOf?: string) =>
    api.get(`/tax/${portfolioId}/summary`, { params: asOf ? { as_of: asOf } : {} }).then((r) => r.data),
  harvest:  (portfolioId: number) => api.get(`/tax/${portfolioId}/harvest`).then((r) => r.data),
  scenario: (portfolioId: number, sellMap: Record<string, number>) =>
    api.post(`/tax/${portfolioId}/scenario`, { sell_map: sellMap }).then((r) => r.data),
};

export const alertsAPI = {
  list:       (portfolioId: number) => api.get(`/alerts/${portfolioId}/alerts`).then((r) => r.data),
  syncPrices: (portfolioId: number) => api.post(`/alerts/${portfolioId}/sync-prices`).then((r) => r.data),
};

export const exportAPI = {
  scheduleGC:  (portfolioId: number) => api.get(`/export/${portfolioId}/schedule-cg`).then((r) => r.data),
  downloadCSV: async (portfolioId: number, fy: string) => {
    const res = await api.get(`/export/${portfolioId}/schedule-cg/csv`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement("a");
    a.href = url; a.download = `schedule_cg_fy${fy}.csv`; a.click();
    URL.revokeObjectURL(url);
  },
};

export const advisorAPI = {
  chat: (portfolioId: number, messages: { role: string; content: string }[]) =>
    api.post("/advisor/chat", { portfolio_id: portfolioId, messages }).then((r) => r.data),
};

export const b2bAPI = {
  listClients:      () => api.get("/b2b/clients").then((r) => r.data),
  createClient:     (data: any) => api.post("/b2b/clients", data).then((r) => r.data),
  taxOverview:      () => api.get("/b2b/tax-overview").then((r) => r.data),
  clientSummary:    (clientId: number) => api.get(`/b2b/client/${clientId}/tax-summary`).then((r) => r.data),
  deactivateClient: (clientId: number) => api.delete(`/b2b/client/${clientId}`).then((r) => r.data),
};

export default api;
