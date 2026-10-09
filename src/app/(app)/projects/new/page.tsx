import type { Metadata } from "next";
import { createProjectAction } from "@/app/actions";
import { ProjectForm } from "@/components/project-form";
import { Card, PageHeader } from "@/components/ui";
import { projectCategories } from "@/server/projects";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Novo projecto" };

export default async function NewProject(props: PageProps<"/projects/new">) {
  await requireUser(["member"]);
  const sp = await props.searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo projecto" description="A página do projecto é a sua montra perante avaliadores, investidores e a comunidade." />
      <Card className="p-5 sm:p-7">
        <ProjectForm action={createProjectAction} categories={projectCategories()} returnTo={typeof sp.returnTo === "string" ? sp.returnTo.replace(/\/submit$/, "/submit") : undefined} />
      </Card>
    </div>
  );
}
