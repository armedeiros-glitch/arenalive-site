import Link from "next/link";
import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ status?: string; next?: string }>;
};

const MESSAGES: Record<string, string> = {
  sent: "Pronto. Enviamos seu link de acesso por e-mail.",
  "invalid-email": "Confira o e-mail informado.",
  "send-error": "Não foi possível enviar o acesso agora. Tente novamente em instantes.",
};

function safeNextPath(value?: string) {
  if (!value) return "/";
  if (value === "/cotacao") return value;
  if (value === "/supplier/opportunities" || value.startsWith("/supplier/opportunities/")) return value;
  if (value === "/account" || value === "/") return value;
  return "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { status, next: requestedNext } = await searchParams;
  const message = status ? MESSAGES[status] : null;
  const next = safeNextPath(requestedNext);
  const supplierFlow = next.startsWith("/supplier/opportunities");
  const buyerFlow = next === "/cotacao";

  return (
    <main className="min-h-screen bg-[#f6f2e9] px-5 py-8 text-[#17191d]">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link>

        <section className="mt-12 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-600">
            {supplierFlow ? "Acesso fornecedor" : buyerFlow ? "Começar cotação" : "Acesso CotaPeça"}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Entre com seu e-mail.</h1>
          <p className="mt-3 leading-7 text-black/55">
            Sem senha para decorar. Você recebe um link seguro e continua de onde parou.
          </p>

          <form action={requestMagicLink} className="mt-7 flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="email" className="text-sm font-black">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@exemplo.com"
              className="h-13 rounded-2xl border border-black/15 bg-white px-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
            <button type="submit" className="mt-2 h-13 rounded-2xl bg-[#17191d] px-4 font-black text-white transition hover:bg-black">
              ENVIAR LINK DE ACESSO
            </button>
          </form>

          {message ? (
            <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${status === "sent" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {message}
            </p>
          ) : null}

          <p className="mt-6 text-xs leading-5 text-black/40">Ao entrar, você concorda com o uso dos dados necessários para operar sua cotação com segurança.</p>
        </section>
      </div>
    </main>
  );
}
