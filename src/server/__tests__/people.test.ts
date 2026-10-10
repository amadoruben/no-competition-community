import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { DomainError } from "../errors";
import { changeRole, listPeople } from "../people";

const mk = async (handle: string, role: User["role"] = "member") =>
  (await db.insert(users).values({ email: `${handle}@p.test`, authSubject: `s-${handle}`, name: handle, handle, role }).returning())[0];
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));

describe("people and roles (investor)", () => {
  it("lets the investor promote a member to evaluator and back", async () => {
    const inv = await mk("p-inv", "investor");
    const m = await mk("p-mem");
    expect((await changeRole(inv, m.id, "evaluator")).role).toBe("evaluator");
    expect((await changeRole(inv, m.id, "member")).role).toBe("member");
    const { rows } = await listPeople(inv, { q: "p-mem" });
    expect(rows.map((r) => r.handle)).toEqual(["p-mem"]);
  });

  it("refuses non-investors, self-changes, investor targets and unknown roles", async () => {
    const inv = await mk("p-inv2", "investor");
    const other = await mk("p-inv3", "investor");
    const m = await mk("p-mem2");
    expect(await code(changeRole(m, m.id, "evaluator"))).toBe("forbidden");
    expect(await code(listPeople(m))).toBe("forbidden");
    expect(await code(changeRole(inv, inv.id, "member"))).toBe("forbidden");
    expect(await code(changeRole(inv, other.id, "member"))).toBe("forbidden");
    expect(await code(changeRole(inv, m.id, "investor"))).toBe("invalid");
  });
});
