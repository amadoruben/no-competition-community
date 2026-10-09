"use client";

import { useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Dialog, Switch, Tooltip } from "@/components/overlay";
import { toast } from "@/components/toaster";
import { Button, Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

async function demoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get("name") ?? "");
  if (name.trim().length < 2) return { ok: false, error: "Reveja os campos assinalados.", fieldErrors: { name: "Nome: mínimo 2 caracteres." }, at: Date.now() };
  return { ok: true, message: "Exemplo validado (nada foi guardado).", at: Date.now() };
}

/** Interactive pieces of the reference page (client-side only, nothing persisted). */
export function DesignInteractive() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <ActionForm action={demoAction} className="space-y-4">
          <Field name="name" label="Nome" hint="Submeta vazio para ver o erro por campo.">
            <Input name="name" placeholder="Ex.: Voltaica" />
          </Field>
          <Field name="stage" label="Fase">
            <Select name="stage" defaultValue="mvp">
              <option value="idea">Ideia</option>
              <option value="mvp">MVP</option>
            </Select>
          </Field>
          <Field name="about" label="Descrição">
            <Textarea name="about" rows={3} />
          </Field>
          <Switch name="share" defaultChecked label="Partilhar no feed" description="Interruptor acessível (role=switch)." />
          <SubmitButton>Validar exemplo</SubmitButton>
        </ActionForm>
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>Abrir diálogo</Button>
          <Button variant="secondary" onClick={() => toast("Notificação de sucesso")}>Toast</Button>
          <Button variant="secondary" onClick={() => toast("Notificação de erro", "bad")}>Toast de erro</Button>
          <Tooltip content="Explicação curta, também ao foco do teclado">
            <Button variant="ghost">Com tooltip</Button>
          </Tooltip>
        </div>
        <Dialog open={open} onClose={() => setOpen(false)} title="Publicar resultados?" description="Ficam visíveis para toda a comunidade. Esta acção não pode ser revertida." size="sm" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="accent" onClick={() => setOpen(false)}>Confirmar</Button></>} />
      </Card>
    </div>
  );
}
