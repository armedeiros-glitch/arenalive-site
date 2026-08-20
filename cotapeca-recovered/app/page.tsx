import Link from "next/link";

const steps = [
  ["01", "Conte o que precisa", "Veículo, peça e região em poucos passos."],
  ["02", "O CotaPeça distribui", "O pedido chega a fornecedores compatíveis com o seu caso."],
  ["03", "Você acompanha", "Menos ligação, menos tempo perdido, mais clareza."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-30 border-b border-black/[.06] bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-[1.15rem] font-black tracking-[-.045em]">
            Cota<span className="text-orange-600">Peça</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-semibold text-black/60">
            <Link href="/auth/login?next=/supplier/opportunities" className="transition hover:text-black">Fornecedor</Link>
            <Link href="/auth/login?next=/cotacao" className="rounded-full bg-[#1d1d1f] px-4 py-2 text-white transition hover:bg-black">Começar</Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate mx-auto flex min-h-[78vh] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,.16)_0%,_rgba(249,115,22,.06)_35%,_transparent_68%)]" />
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-black/45">Cotação de autopeças, sem enrolação.</p>
        <h1 className="mt-5 max-w-5xl text-[3.8rem] font-black leading-[.9] tracking-[-.065em] sm:text-[5.8rem] lg:text-[7.4rem]">
          A peça certa.
          <span className="block bg-gradient-to-r from-[#ff7a00] via-[#ff5a1f] to-[#d9480f] bg-clip-text text-transparent">Sem peregrinação.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-black/50 sm:text-[1.35rem] sm:leading-9">
          Você faz um pedido. O CotaPeça encontra fornecedores compatíveis e organiza o caminho até a resposta.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/auth/login?next=/cotacao" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1d1d1f] px-6 text-sm font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.12)] transition duration-200 hover:-translate-y-0.5 hover:bg-black">
            Fazer cotação
          </Link>
          <Link href="/auth/login?next=/supplier/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-[#0066cc] transition hover:bg-black/[.035]">
            Sou fornecedor <span className="ml-1">›</span>
          </Link>
        </div>
        <p className="mt-4 text-xs font-semibold text-black/35">Grátis para quem está procurando a peça.</p>
      </section>

      <section className="px-5 pb-8 sm:px-8 sm:pb-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] bg-black text-white shadow-[0_30px_80px_rgba(0,0,0,.16)]">
          <div className="grid min-h-[34rem] items-stretch lg:grid-cols-[1.05fr_.95fr]">
            <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/40">Uma vez só.</p>
              <h2 className="mt-4 max-w-xl text-4xl font-black leading-[.95] tracking-[-.05em] sm:text-6xl">Você pede. A rede trabalha.</h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/50 sm:text-lg">Nada de mandar a mesma mensagem para loja por loja. O pedido entra uma vez e vai para quem faz sentido.</p>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden bg-[#111113] p-6 sm:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(249,115,22,.16),transparent_46%)]" />
              <div className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/[.08] p-5 shadow-2xl backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Pedido em andamento</p>
                    <p className="mt-1 text-lg font-bold tracking-tight">Farol dianteiro • Gol 2018</p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,.85)]" />
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white/[.07] p-4">
                    <p className="text-sm font-bold">Joinville • 60 km</p>
                    <p className="mt-1 text-xs text-white/40">Usada original • aceita envio</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4 text-black">
                      <p className="text-3xl font-black tracking-[-.055em]">12</p>
                      <p className="mt-1 text-xs font-semibold text-black/40">fornecedores compatíveis</p>
                    </div>
                    <div className="rounded-2xl bg-[#f97316] p-4 text-white">
                      <p className="text-3xl font-black tracking-[-.055em]">1x</p>
                      <p className="mt-1 text-xs font-semibold text-white/70">você faz o pedido</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/50">✓ Seus dados ficam protegidos durante a cotação.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Simples por fora. Inteligente por trás.</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Três passos. Sem novela.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <article key={number} className="rounded-[1.75rem] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,.04)] ring-1 ring-black/[.05] sm:p-7">
                <p className="text-xs font-bold text-orange-600">{number}</p>
                <h3 className="mt-10 text-2xl font-black tracking-[-.035em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/45">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-white p-7 ring-1 ring-black/[.05] sm:flex-row sm:items-center sm:p-9">
          <div>
            <p className="text-2xl font-black tracking-[-.04em]">Tem autopeças para vender?</p>
            <p className="mt-2 text-sm text-black/45">Entre no painel e receba oportunidades compatíveis.</p>
          </div>
          <Link href="/auth/login?next=/supplier/opportunities" className="text-sm font-bold text-[#0066cc]">Acessar painel fornecedor ›</Link>
        </div>
      </section>
    </main>
  );
}
