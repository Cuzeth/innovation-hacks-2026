"use client";

/**
 * Lightweight markdown renderer for AI-generated text.
 * Handles: **bold**, *italic*, bullet lists, and line breaks.
 */
export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const isBullet = /^[\-\*•]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[\-\*•]\s+/, "") : trimmed;

        const rendered = renderInline(content);

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted select-none">•</span>
              <span>{rendered}</span>
            </div>
          );
        }

        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
