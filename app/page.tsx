import Link from "next/link";

const steps = [
  ["1", "Conte o que precisa", "Informe veículo, peça e sua região."],
  ["2", "A gente encontra as lojas", "O pedido vai para fornecedores compatíveis."],
  ["3", "Você acompanha", "As oportunidades aparecem sem você sair ligando de loja em loja."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f2e9] text-[#17191d]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></div>
        <Link href="/auth/login?next=/supplier/opportunities" className="text-sm font-bold text-black/55 hover:text-black">
          Sou fornecedor
        </Link>
      </header>

      <section className="mx-auto grid min-h-[68vh] w-full max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-[1.15fr_.85fr] md:py-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-600">Cotação de autopeças</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[.95] tracking-[-.045em] sm:text-6xl">
            Ache a peça sem ligar para dez lojas.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-black/60">
            Você envia um pedido uma vez. O CotaPeça distribui para fornecedores compatíveis da sua região.
          </p>
          <Link href="/auth/login?next=/cotacao" className="mt-8 block w-full rounded-2xl bg-orange-600 px-6 py-4 text-center text-base font-black text-white shadow-sm transition hover:bg-orange-700 sm:inline-block sm:w-auto sm:min-w-56">
            COTAR AGORA
          </Link>
          <p className="mt-3 text-xs font-semibold text-black/40">Grátis para quem está procurando a peça.</p>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black">Como funciona</p>
          <div className="mt-6 grid gap-6">
            {steps.map(([number, title, description]) => (
              <div key={number} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-black text-orange-700">{number}</span>
                <div>
                  <h2 className="font-black">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-black/55">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-white/55">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-6 text-sm text-black/55 sm:flex-row sm:items-center sm:justify-between">
          <span>Pedido simples. Dados do comprador protegidos.</span>
          <Link href="/auth/login?next=/supplier/opportunities" className="font-black text-black">Acessar painel fornecedor →</Link>
        </div>
      </section>
    </main>
  );
}
