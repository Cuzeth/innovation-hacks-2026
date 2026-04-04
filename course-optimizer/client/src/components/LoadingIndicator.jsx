import React from "react";

export default function LoadingIndicator({ message }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-sm font-bold">AI</span>
      </div>
      <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-md">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
            <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
            <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
          </div>
          {message && (
            <span className="text-sm text-gray-400 ml-1">{message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
