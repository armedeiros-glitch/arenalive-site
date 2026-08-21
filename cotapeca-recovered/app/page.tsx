import Link from "next/link";

const steps = [
  ["01", "Conte o que precisa", "Veículo, peça e região."],
  ["02", "As lojas recebem", "O pedido vai para quem pode ter."],
  ["03", "Você acompanha", "Tudo no mesmo lugar."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] lg:h-screen lg:overflow-hidden">
      <header className="border-b border-black/[.06] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-[1.1rem] font-black tracking-[-.045em]">
            Cota<span className="text-orange-600">Peça</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/auth/login?next=/supplier/opportunities" className="hidden text-black/50 transition hover:text-black sm:block">
              Fornecedor
            </Link>
            <Link href="/auth/login?next=/cotacao" className="rounded-full bg-[#1d1d1f] px-4 py-2 text-white transition hover:bg-black">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 sm:px-8 lg:h-[calc(100vh-3.5rem)] lg:grid-rows-[1fr_auto] lg:py-6">
        <section className="grid min-h-0 gap-5 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative flex min-h-[29rem] flex-col justify-center overflow-hidden rounded-[2rem] bg-white p-7 ring-1 ring-black/[.05] sm:p-10 lg:min-h-0 lg:p-9 xl:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,.15)_0%,_transparent_68%)]" />
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-black/35">Cotação de autopeças, sem enrolação.</p>
            <h1 className="mt-4 max-w-3xl text-[3.25rem] font-black leading-[.9] tracking-[-.06em] sm:text-[4.35rem] lg:text-[clamp(3.55rem,4.35vw,5.15rem)]">
              Você diz a peça que seu carro precisa.
              <span className="block bg-gradient-to-r from-[#ff7a00] via-[#ff5a1f] to-[#d9480f] bg-clip-text text-transparent">A gente encontra quem tem.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-6 text-black/48 sm:text-[1.05rem] sm:leading-7">
              Faça o pedido uma vez. O CotaPeça procura lojas que podem ter a peça e organiza as respostas para você.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/auth/login?next=/cotacao" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1d1d1f] px-6 text-sm font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:bg-black">
                Fazer cotação
              </Link>
              <Link href="/auth/login?next=/supplier/opportunities" className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#0066cc] transition hover:bg-black/[.035]">
                Sou fornecedor ›
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-semibold text-black/35">
              <span>✓ Grátis para quem procura</span>
              <span>✓ Dados protegidos</span>
              <span>✓ Pedido em poucos passos</span>
            </div>
          </div>

          <div className="relative flex min-h-[29rem] items-center justify-center overflow-hidden rounded-[2rem] bg-[#0b0b0c] p-6 text-white shadow-[0_28px_70px_rgba(0,0,0,.14)] sm:p-9 lg:min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_15%,rgba(249,115,22,.2),transparent_38%)]" />
            <div className="relative w-full max-w-lg">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Seu pedido</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">A gente procura nas lojas.</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-xs font-semibold text-white/55">ao vivo</span>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[.07] p-5 backdrop-blur-2xl">
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/35">Pedido em andamento</p>
                    <p className="mt-1 text-xl font-black tracking-[-.03em]">Farol dianteiro • Gol 2018</p>
                  </div>
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,.9)]" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/[.06] p-4 sm:col-span-2">
                    <p className="text-sm font-bold">Joinville • até 60 km</p>
                    <p className="mt-1 text-xs text-white/40">Usada original • aceita envio</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-black">
                    <p className="text-3xl font-black tracking-[-.06em]">Lojas</p>
                    <p className="mt-1 text-xs font-semibold text-black/42">que atendem esse tipo de pedido</p>
                  </div>
                  <div className="rounded-2xl bg-[#f97316] p-4 text-white">
                    <p className="text-4xl font-black tracking-[-.06em]">1x</p>
                    <p className="mt-1 text-xs font-semibold text-white/75">você faz o pedido</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {steps.map(([number, title, description]) => (
                  <div key={number} className="rounded-2xl border border-white/10 bg-white/[.045] p-3.5">
                    <p className="text-[10px] font-bold text-orange-400">{number}</p>
                    <p className="mt-4 text-sm font-bold leading-tight">{title}</p>
                    <p className="mt-1.5 hidden text-[11px] leading-4 text-white/35 sm:block">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-3 rounded-[1.5rem] bg-white px-5 py-4 ring-1 ring-black/[.05] sm:flex-row sm:items-center sm:px-6">
          <div>
            <p className="text-sm font-black tracking-[-.02em]">Tem autopeças para vender?</p>
            <p className="mt-0.5 text-xs text-black/40">Receba pedidos que combinam com o que sua loja atende.</p>
          </div>
          <Link href="/auth/login?next=/supplier/opportunities" className="text-sm font-bold text-[#0066cc]">Acessar painel fornecedor ›</Link>
        </section>
      </div>
    </main>
  );
}