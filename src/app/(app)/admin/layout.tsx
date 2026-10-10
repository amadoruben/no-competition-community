import { AdminNav } from "@/components/app-nav";
import { requireUser } from "@/server/session";

/** Administração: the investor's tools, with their own tabs, apart from the member navigation. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUser(["investor"]);
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
