import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";

/** "Perfil" in the navigation: the member's own public profile, with account tools. */
export default async function ProfilePage() {
  const user = await requireUser();
  redirect(`/members/${user.handle}`);
}
