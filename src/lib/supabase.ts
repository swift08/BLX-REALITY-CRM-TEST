// Client-side Supabase dummy module.
// All database and auth operations are run securely on the server via server functions.
export const isSupabaseConfigured = true;

// Mock object to prevent compile errors for legacy imports.
// These are not used for actual data fetching/auth as those now go through server functions.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signUp: async () => ({ data: { user: null }, error: new Error("Auth runs server-side") }),
    signInWithPassword: async () => ({
      data: { session: null },
      error: new Error("Auth runs server-side"),
    }),
    signOut: async () => ({ error: null }),
  },
} as any;
