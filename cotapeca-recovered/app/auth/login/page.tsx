import Link from "next/link";
import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ status?: string; next?: string }>;
};

const MESSAGES: Record<string, string> = {
  sent: "Link enviado. Dá uma olhada no seu e-mail para continuar.",
  "invalid-email": "Informe um e-mail válido.",
  "send-error": "Não foi possível enviar o acesso agora.",
};

function safeNextPath(value?: string) {
  if (!value) return "/account";
  if (value === "/cotacao") return value;
  if (value === "/supplier/opportunities" || value.startsWith("/supplier/opportunities/")) return value;
  if (value === "/account" || value === "/") return value;
  return "/account";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { status, next: requestedNext } = await searchParams;
  const message = status ? MESSAGES[status] : null;
  const next = safeNextPath(requestedNext);
  const supplierFlow = next.startsWith("/supplier/opportunities");

  return (
    <main className="min-h-screen bg-[#f4efe5] px-5 py-7 text-[#17191d]">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-black tracking-[-.04em]">
          Cota<span className="text-orange-600">Peça</span>
        </Link>

        <section className="relative mt-10 overflow-hidden rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_22px_60px_rgba(23,25,29,.08)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-orange-500/15 blur-2xl" />
          <div className="relative">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-orange-600">
              {supplierFlow ? "Acesso fornecedor" : "Começar cotação"}
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[.95] tracking-[-.04em]">
              {supplierFlow ? "Entre no painel." : "Vamos achar essa peça."}
            </h1>
            <p className="mt-4 leading-7 text-black/52">
              Sem senha para decorar. Digite seu e-mail e a gente manda um link seguro para continuar.
            </p>

            <form action={requestMagicLink} className="mt-7 flex flex-col gap-3">
              <input type="hidden" name="next" value={next} />
              <label htmlFor="email" className="text-sm font-black">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" className="input" />
              <button type="submit" className="mt-2 min-h-13 rounded-2xl bg-[#17191d] px-4 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black">
                ENVIAR LINK DE ACESSO →
              </button>
            </form>

            {message ? (
              <div className="mt-5 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">{message}</div>
            ) : null}

            <p className="mt-6 text-xs leading-5 text-black/36">
              Seus dados são usados somente para operar a cotação e manter o acesso seguro.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
