import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fontaneria de autenticacion, no logica de negocio (regla 1):
// obtiene el cliente de Supabase y el usuario logueado juntos, o
// manda a /login. getUser() y no getSession(): valida el JWT contra
// el servidor de auth en vez de fiarse de la cookie.
//
// SOLO para Server Actions que ESCRIBEN datos, como primera linea,
// sin excepcion. Las lecturas (searchFoods y similares) NO la
// necesitan: RLS ya devuelve vacio sin sesion, y meterle un redirect
// aqui convertiria un buscador vacio en un salto de pagina.
//
// requireUser() puede lanzar (redirect() lo hace por diseño). NUNCA
// la envuelvas en try/catch: se tragaria la redireccion (NEXT_REDIRECT)
// y lo convertiria en un error generico -- el usuario sin sesion se
// quedaria mirando una pantalla rota en vez de ir a /login.
export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
