import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateProjectAction } from "@/app/actions";
import { ProjectForm } from "@/components/project-form";
import { Card, PageHeader } from "@/components/ui";
import { DomainError } from "@/server/errors";
import { getProjectBySlug, projectCategories } from "@/server/projects";
import { requireUser } from "@/server/session";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Editar projecto" };

export default async function EditProject(props: PageProps<"/projects/[slug]/edit">) {
  const user = await requireUser();
  const { slug } = await props.params;
  let d;
  try {
    d = getProjectBySlug(slug, user);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (!d.isMember) redirect(`/projects/${slug}`);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Editar ${d.project.name}`} />
      <Card className="p-5 sm:p-7">
        <ProjectForm action={updateProjectAction.bind(null, d.project.id)} project={d.project} categories={projectCategories()} />
      </Card>
      {d.isOwner && (
        <Card className="p-5 sm:p-7">
          <TeamManager projectId={d.project.id} team={d.team.map((t) => ({ name: t.name, handle: t.handle, title: t.title, hue: t.avatarHue }))} />
        </Card>
      )}
    </div>
  );
}
