export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold">Não foi possível confirmar o acesso.</h1>
      <p className="text-neutral-700">Solicite um novo link de acesso e tente novamente.</p>
    </main>
  );
}
