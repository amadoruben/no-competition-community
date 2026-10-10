import { Fragment } from "react";

const URL_RE = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,:;!?')\]]/gi;

/** "https://www.site.pt/a/b?c" → "site.pt/a/b?c", shortened for display. */
function shortUrl(href: string) {
  const s = href.replace(/^https?:\/\/(www\.)?/i, "");
  return s.length > 42 ? `${s.slice(0, 40)}…` : s;
}

function Linked({ text }: { text: string }) {
  const links = text.match(URL_RE) ?? [];
  return text.split(URL_RE).map((chunk, j, parts) => (
    <Fragment key={j}>
      {chunk}
      {j < parts.length - 1 && links[j] && (
        <a href={links[j]} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium break-all text-info underline-offset-2 hover:underline">
          {shortUrl(links[j])}
        </a>
      )}
    </Fragment>
  ));
}

/**
 * Plain text with line breaks kept and web links made clickable. Nothing else
 * is interpreted: no HTML, no markdown, only http(s) links (never javascript:).
 * `flow` keeps everything in one block, which is what line clamping needs;
 * `inline` continues a sentence (a caption after the author's name).
 */
export function RichText({ text, className, flow, inline }: { text: string; className?: string; flow?: boolean; inline?: boolean }) {
  if (inline)
    return (
      <span className={className} style={{ whiteSpace: "pre-line" }}>
        <Linked text={text} />
      </span>
    );
  if (flow)
    return (
      <p className={className} style={{ whiteSpace: "pre-line" }}>
        <Linked text={text} />
      </p>
    );
  return (
    <div className={className}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line [&+&]:mt-3">
          <Linked text={para} />
        </p>
      ))}
    </div>
  );
}
