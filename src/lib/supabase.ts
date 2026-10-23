import { createClient } from "@supabase/supabase-js";

// Public client configuration. These keys identify the app; RLS protects every row.
// Never put a service_role/secret key in a VITE_* variable or in this module.
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://dbneonomwrqwlbitwdtr.supabase.co";
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM";

export const supabase = createClient(url, publishableKey, {
  auth: {
    storageKey: "hanpun-auth-v1",
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}
