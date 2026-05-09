import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (t: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: localStorage.getItem("token"),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ token: null });
  },
}));

interface PortfolioState {
  activePortfolioId: number | null;
  setActivePortfolioId: (id: number | null) => void;
}

export const usePortfolioStore = create<PortfolioState>()((set) => ({
  activePortfolioId: null,
  setActivePortfolioId: (id) => set({ activePortfolioId: id }),
}));