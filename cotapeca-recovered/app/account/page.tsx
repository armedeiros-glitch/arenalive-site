import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold">Sessão autenticada</h1>
      <p className="text-neutral-700">{data.user.email}</p>
      <p className="text-sm text-neutral-500">Área temporária de validação da Sprint 0.</p>
    </main>
  );
}
