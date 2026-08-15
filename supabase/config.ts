import {
  createBrowserClient,
  createServerClient,
} from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Para Client Components ("use client"). Se ejecuta en el navegador.
export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Para Server Components, Server Actions y Route Handlers.
// Import perezoso de next/headers para no arrastrarlo al bundle de cliente
// si algún Client Component importa este archivo solo por la función de arriba.
export async function createServerSupabaseClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll fue llamado desde un Server Component sin middleware
          // que refresque la sesión. Se puede ignorar si hay middleware.
        }
      },
    },
  });
}
