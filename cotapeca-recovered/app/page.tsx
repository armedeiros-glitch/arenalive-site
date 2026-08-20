export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
        CotaPeça V1
      </p>
      <h1 className="text-4xl font-black leading-tight tracking-tight">
        Fundação técnica pronta para evoluir por sprint.
      </h1>
      <p className="text-base leading-7 text-neutral-700">
        Esta tela é apenas o marco da Sprint 0. O fluxo do comprador começa na Sprint 1.
      </p>
      <div className="rounded-2xl border border-neutral-300 bg-white/70 p-4 text-sm leading-6">
        <strong>Escopo protegido:</strong> Pedido → distribuição → oportunidade → proposta → comparação → WhatsApp.
      </div>
    </main>
  );
}
