import { redirect } from "next/navigation";

/** "Aprender" became "Vídeos". */
export default function LearnPage() {
  redirect("/videos");
}
