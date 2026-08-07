import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserResponse } from '../types'

interface AuthState {
  token: string | null
  user: UserResponse | null
  isAuthenticated: boolean
  login: (token: string, user: UserResponse) => void
  logout: () => void
  setUser: (user: UserResponse) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),

      setUser: (user) => set({ user }),
    }),
    {
      name: 'scraper-auth',
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<AuthState> | undefined
        return {
          ...currentState,
          token: p?.token ?? null,
          user: p?.user ?? null,
          isAuthenticated: Boolean(p?.token && p?.user),
        }
      },
    },
  ),
)
