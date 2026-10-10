import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/feed/comment-thread";
import { PostCard } from "@/components/feed/post-card";
import { timeAgo } from "@/lib/format";
import { getPost } from "@/server/community";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";

async function load(id: string) {
  const user = await requireUser();
  try {
    return { user, post: await getPost(user, id) };
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
}

export async function generateMetadata(props: PageProps<"/community/[id]">): Promise<Metadata> {
  const { post } = await load((await props.params).id);
  const text = post.post.title || post.post.body;
  return { title: text ? (text.length > 60 ? `${text.slice(0, 58)}…` : text) : `Publicação de ${post.authorName}` };
}

/** One post with its full text, photos or video, and the whole conversation with replies. */
export default async function PostPage(props: PageProps<"/community/[id]">) {
  const { user, post } = await load((await props.params).id);
  return (
    <div className="mx-auto max-w-[680px] space-y-2 sm:space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Início
      </Link>
      <PostCard item={post} full viewer={{ id: user.id, role: user.role }} />
      <CommentThread
        postId={post.post.id}
        viewer={{ id: user.id, role: user.role }}
        me={{ name: user.name, hue: user.avatarHue, fileId: user.avatarFileId }}
        comments={post.comments.map((c) => ({
          id: c.c.id,
          parentId: c.c.parentId,
          body: c.c.body,
          authorId: c.c.authorId,
          authorName: c.authorName,
          authorHandle: c.authorHandle,
          authorHue: c.authorHue,
          authorAvatar: c.authorAvatar,
          authorRole: c.authorRole,
          when: timeAgo(c.c.createdAt),
          at: c.c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
