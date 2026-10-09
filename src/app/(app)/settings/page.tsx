import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar perfil" description="O seu perfil é público para os membros da comunidade." />
      <Card className="p-5 sm:p-7"><ProfileForm user={user} /></Card>
    </div>
  );
}
