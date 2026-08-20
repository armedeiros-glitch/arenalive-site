import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const MESSAGES: Record<string, string> = {
  sent: "Enviamos o link de acesso para o seu e-mail.",
  "invalid-email": "Informe um e-mail válido.",
  "send-error": "Não foi possível enviar o acesso agora.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { status } = await searchParams;
  const message = status ? MESSAGES[status] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Acesso CotaPeça
      </p>
      <h1 className="text-3xl font-black tracking-tight">Entrar sem senha</h1>
      <p className="text-neutral-700">
        Informe seu e-mail. Este fluxo valida a autenticação passwordless da fundação e será reaproveitado no ponto correto do funil do comprador.
      </p>

      <form action={requestMagicLink} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-semibold">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 rounded-xl border border-neutral-300 bg-white px-4 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-neutral-950 px-4 font-bold text-white"
        >
          Enviar acesso
        </button>
      </form>

      {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
    </main>
  );
}
