"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton, useFormState } from "./form";
import { Avatar, buttonClass, ProjectLogo } from "./ui";

/** Upload/replace/remove a single image (avatar or project logo). */
export function ImageUpload({
  action,
  name,
  hue,
  fileId,
  shape,
  label,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  name: string;
  hue: number;
  fileId: string | null;
  shape: "avatar" | "logo";
  label: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <ActionForm action={action} onSuccess={() => setPreview(null)} className="flex flex-wrap items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={preview} alt="" className={shape === "avatar" ? "size-16 rounded-full object-cover" : "size-16 rounded-2xl object-cover"} />
      ) : shape === "avatar" ? (
        <Avatar name={name} hue={hue} fileId={fileId} size={64} />
      ) : (
        <ProjectLogo name={name} hue={hue} fileId={fileId} size={64} />
      )}
      <Picker label={label} onPick={setPreview} hasImage={!!fileId} />
    </ActionForm>
  );
}

function Picker({ label, onPick, hasImage }: { label: string; onPick: (url: string | null) => void; hasImage: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState(false);
  const { pending } = useFormState();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className={buttonClass("secondary", "sm", "cursor-pointer")}>
          <ImageUp className="size-4" /> {label}
          <input
            ref={input}
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setChosen(!!f);
              onPick(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        {chosen && <SubmitButton size="sm" pendingLabel="A carregar…">Guardar imagem</SubmitButton>}
        {hasImage && !chosen && (
          <button type="submit" name="remove" value="1" disabled={pending} className={buttonClass("ghost", "sm")}>
            <Trash2 className="size-4" /> Remover
          </button>
        )}
      </div>
      <p className="text-[12px] text-muted">PNG, JPEG ou WebP, até 2 MB.</p>
    </div>
  );
}
