import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-black px-3 py-2 text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
