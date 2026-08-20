import Link from "next/link";

const steps = [
  ["01", "Peça o que precisa", "Veículo, peça e região em poucos passos."],
  ["02", "A gente espalha o pedido", "Só fornecedores compatíveis recebem a oportunidade."],
  ["03", "Você acompanha", "Menos ligação, menos caça ao tesouro."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe5] text-[#17191d]">
      <div className="relative isolate">
        <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute left-[-10rem] top-[28rem] h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-[1.35rem] font-black tracking-[-.04em]">
            Cota<span className="text-orange-600">Peça</span>
          </Link>
          <Link
            href="/auth/login?next=/supplier/opportunities"
            className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-black text-black/65 backdrop-blur transition hover:bg-white hover:text-black"
          >
            Sou fornecedor
          </Link>
        </header>

        <section className="relative z-10 mx-auto grid min-h-[72vh] w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 md:grid-cols-[1.06fr_.94fr] md:pb-24 md:pt-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-600/15 bg-orange-600/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.18em] text-orange-700">
              <span className="h-2 w-2 rounded-full bg-orange-600" />
              Cotação sem peregrinação
            </div>
            <h1 className="mt-6 max-w-3xl text-[3.5rem] font-black leading-[.88] tracking-[-.065em] sm:text-[4.7rem] lg:text-[5.5rem]">
              A peça certa,
              <span className="block text-orange-600">sem rodar a cidade.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-black/58 sm:text-xl">
              Faça um pedido uma vez. O CotaPeça encontra os fornecedores que fazem sentido para o seu carro e sua região.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/login?next=/cotacao"
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#17191d] px-6 py-4 text-base font-black text-white shadow-[0_14px_35px_rgba(23,25,29,.18)] transition hover:-translate-y-0.5 hover:bg-black"
              >
                COTAR AGORA
                <span className="text-xl transition group-hover:translate-x-1">→</span>
              </Link>
              <span className="text-sm font-bold text-black/42">Grátis para quem procura a peça.</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md md:mr-0">
            <div className="absolute -inset-4 rotate-3 rounded-[2.4rem] bg-orange-500/12" />
            <div className="relative rounded-[2rem] border border-black/10 bg-[#17191d] p-5 text-white shadow-[0_28px_80px_rgba(23,25,29,.22)] sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-400">Pedido em andamento</p>
                  <p className="mt-1 text-xl font-black tracking-tight">Farol dianteiro • Gol 2018</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-lg">⚡</span>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-white/[.07] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">Joinville • 60 km</span>
                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">Buscando</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/50">Usada original • aceita envio</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white p-4 text-[#17191d]">
                    <p className="text-3xl font-black tracking-[-.05em]">12</p>
                    <p className="mt-1 text-xs font-bold text-black/45">lojas compatíveis</p>
                  </div>
                  <div className="rounded-2xl bg-orange-500 p-4 text-white">
                    <p className="text-3xl font-black tracking-[-.05em]">1x</p>
                    <p className="mt-1 text-xs font-bold text-white/70">você faz o pedido</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">✓</span>
                  <p className="text-sm font-bold text-white/65">Seus dados ficam protegidos durante a cotação.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-y border-black/8 bg-white/65">
        <div className="mx-auto grid max-w-6xl gap-0 px-5 py-4 sm:px-8 md:grid-cols-3 md:py-0">
          {steps.map(([number, title, description], index) => (
            <div key={number} className={`py-6 md:px-7 md:py-8 ${index > 0 ? "border-t border-black/8 md:border-l md:border-t-0" : ""}`}>
              <p className="text-xs font-black tracking-[.18em] text-orange-600">{number}</p>
              <h2 className="mt-2 text-lg font-black tracking-tight">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-black/50">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black">Tem autopeças para vender?</p>
          <p className="mt-1 text-sm text-black/48">Entre no painel e receba oportunidades compatíveis.</p>
        </div>
        <Link href="/auth/login?next=/supplier/opportunities" className="text-sm font-black text-orange-700">
          ACESSAR PAINEL FORNECEDOR →
        </Link>
      </section>
    </main>
  );
}
