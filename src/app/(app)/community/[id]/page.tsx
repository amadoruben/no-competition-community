import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard, RoleTag } from "@/components/domain";
import { Avatar, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getPost } from "@/server/community";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";
import { CommentForm } from "./comment-form";

export default async function PostPage(props: PageProps<"/community/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  let post;
  try {
    post = getPost(user, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Comunidade
      </Link>
      <PostCard item={post} full />
      <Card className="p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold">{post.comments.length} {post.comments.length === 1 ? "comentário" : "comentários"}</h2>
        <ul className="space-y-5">
          {post.comments.map((c) => (
            <li key={c.c.id} className="flex gap-3">
              <Avatar name={c.authorName} hue={c.authorHue} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Link href={`/members/${c.authorHandle}`} className="font-medium hover:underline">{c.authorName}</Link>
                  <RoleTag role={c.authorRole} />
                  <span className="text-muted">{timeAgo(c.c.createdAt)}</span>
                </div>
                <p className="mt-1 text-[14px] whitespace-pre-line text-ink-2">{c.c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-line pt-5">
          <CommentForm postId={post.post.id} />
        </div>
      </Card>
    </div>
  );
}
