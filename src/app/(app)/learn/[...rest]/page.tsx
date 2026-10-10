import { redirect } from "next/navigation";

/** Old /learn links keep working. */
export default async function LearnRedirect(props: PageProps<"/learn/[...rest]">) {
  const { rest } = await props.params;
  redirect(`/videos/${rest.map(encodeURIComponent).join("/")}`);
}
