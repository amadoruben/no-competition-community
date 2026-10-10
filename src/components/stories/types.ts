import { localSet } from "@/lib/client/local-set";

/** What the stories bar and viewer receive from the server (plain, serialisable data). */

export type ViewerSlide =
  | { id: string; kind: "photo"; ago: string; caption: string; photo: { url: string; width: number; height: number } }
  | { id: string; kind: "text"; ago: string; caption: string }
  | {
      id: string;
      kind: "digest";
      ago: string;
      label: string;
      title: string;
      detail?: string;
      href: string;
      cta: string;
      image?: string | null;
      cover?: { hue: number; seed: string; theme: string };
      art?: "megaphone" | "wave" | "trophy" | "calendar" | "clapper" | "party";
    };

export type ViewerGroup = {
  /** The author's id, or "digest" for the community's weekly news. */
  key: string;
  name: string;
  href?: string;
  avatar: { kind: "brand" } | { kind: "person"; hue: number; fileId: string | null };
  official?: boolean;
  own?: boolean;
  /** The author or the administration may delete these stories. */
  canDelete?: boolean;
  slides: ViewerSlide[];
};

/** Stories already watched on this device (kept locally: nothing about viewing is sent to the server). */
export const seenStories = localSet("ncc:stories:seen");
