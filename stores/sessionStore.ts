import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type SessionState = {
  session: Session | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * WHY: Central store keeps auth session in sync across the app.
 * HOW: On init we read the current session, update state, and expose helpers to refresh or sign out.
 */
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => set({ session }),
  initialize: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Failed to initialize session:', error);
      set({ session: null, initialized: true });
      return;
    }
    set({ session: data.session ?? null, initialized: true });
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    set({ session: null });
  },
}));


