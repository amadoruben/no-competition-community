import type { Metadata } from "next";
import { avatarAction } from "@/app/actions";
import { ImageUpload } from "@/components/image-upload";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar perfil" description="O seu perfil é público para os membros da comunidade." />
      <Card className="mb-6 p-5 sm:p-7">
        <h2 className="mb-4 font-display text-lg font-semibold">Fotografia</h2>
        <ImageUpload action={avatarAction} name={user.name} hue={user.avatarHue} fileId={user.avatarFileId} shape="avatar" label="Escolher fotografia" />
      </Card>
      <Card className="p-5 sm:p-7"><ProfileForm user={user} /></Card>
      {!user.isDemo && <Card className="mt-6 p-5 sm:p-7"><DeleteAccount email={user.email} /></Card>}
    </div>
  );
}
