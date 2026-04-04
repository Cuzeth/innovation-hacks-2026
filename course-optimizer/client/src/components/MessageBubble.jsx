import React from "react";

/**
 * Parse minimal markdown into React elements safely.
 */
function renderMarkdown(text) {
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    // Handle bullet points
    let isBullet = false;
    if (remaining.startsWith("- ")) {
      isBullet = true;
      remaining = remaining.slice(2);
    }

    // Parse bold and inline code
    const regex = /(\*\*(.*?)\*\*|`(.*?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
      }

      if (match[2] !== undefined) {
        parts.push(
          <strong key={key++} className="text-white font-semibold">
            {match[2]}
          </strong>
        );
      } else if (match[3] !== undefined) {
        parts.push(
          <code key={key++} className="bg-gray-700 px-1 rounded text-indigo-300 text-sm">
            {match[3]}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < remaining.length) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
    }

    return (
      <React.Fragment key={lineIdx}>
        {lineIdx > 0 && <br />}
        {isBullet && <span className="text-indigo-400 mr-1">&bull;</span>}
        {parts.length > 0 ? parts : <span>{line}</span>}
      </React.Fragment>
    );
  });
}

export default function MessageBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div className={`flex items-start gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser ? "bg-emerald-600" : "bg-indigo-600"
        }`}
      >
        <span className="text-sm font-bold">{isUser ? "You" : "AI"}</span>
      </div>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-emerald-900/50 border border-emerald-800 rounded-tr-sm"
            : "bg-gray-800 border border-gray-700 rounded-tl-sm"
        }`}
      >
        <div className="text-sm leading-relaxed text-gray-200">
          {renderMarkdown(content)}
        </div>
      </div>
    </div>
  );
}
