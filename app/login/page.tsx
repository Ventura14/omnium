import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glow-lime w-full max-w-sm rounded-3xl bg-card p-8">
        <p className="font-display text-3xl font-bold tracking-tight">
          OMNIUM<span className="text-lime">.</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Comida, batch cooking y compra, al coste por gramo de proteína.
        </p>

        <form action={login} className="mt-8 space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="email" className="eyebrow block">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-input px-4 py-3 outline-none focus-visible:border-lime focus-visible:ring-2 focus-visible:ring-lime/30"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="eyebrow block">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-input px-4 py-3 outline-none focus-visible:border-lime focus-visible:ring-2 focus-visible:ring-lime/30"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-lime px-4 py-3 font-display font-bold text-primary-foreground transition hover:-translate-y-0.5"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
