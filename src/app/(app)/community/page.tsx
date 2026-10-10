import { redirect } from "next/navigation";

/** The feed lives on Início; old /community links keep their filters. */
export default async function CommunityPage(props: PageProps<"/community">) {
  const sp = await props.searchParams;
  const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  redirect(`/dashboard${q.size ? `?${q}` : ""}`);
}
