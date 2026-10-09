import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@/db/schema";
import { resolveUser } from "./accounts";
import { auth } from "./auth";

/** The signed-in application user for this request (validated by the auth provider). */
export const currentUser = cache(async (): Promise<User | null> => {
  const identity = await auth().currentIdentity();
  return identity ? resolveUser(identity) : null;
});

/** For pages: redirect to login when signed out, home when the role is wrong. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user));
  return user;
}

export function homeFor(user: Pick<User, "role">) {
  return user.role === "investor" ? "/admin" : user.role === "evaluator" ? "/review" : "/dashboard";
}
