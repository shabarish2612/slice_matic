import { createClient, SupabaseClient } from "@supabase/supabase-js";

const getEnvOrStorage = (key: string): string => {
  const envVal = (import.meta as any).env?.[key] || "";
  // Check if it's a real value or placeholder
  if (
    envVal && 
    envVal !== "https://your-project.supabase.co" && 
    envVal !== "your-supabase-anon-key" && 
    envVal !== "your-supabase-publishable-key" && 
    !envVal.includes("your-project")
  ) {
    return envVal;
  }
  return localStorage.getItem(key) || "";
};

export const getSupabaseUrl = (): string => {
  return getEnvOrStorage("VITE_SUPABASE_URL");
};

export const getSupabasePublishableKey = (): string => {
  return getEnvOrStorage("VITE_SUPABASE_PUBLISHABLE_KEY") || getEnvOrStorage("VITE_SUPABASE_ANON_KEY");
};

export const getSupabaseAnonKey = (): string => {
  return getSupabasePublishableKey();
};

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return typeof url === "string" && 
         url.length > 0 && 
         url.startsWith("http") &&
         typeof key === "string" && 
         key.length > 0;
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key);
  }

  return supabaseInstance;
};

export const resetSupabaseClient = () => {
  supabaseInstance = null;
};
