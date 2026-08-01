"use client";

import type { ChatView } from "@/lib/assistant/use-assistant";

export default function ChatPanel({ chat }: { chat: ChatView[] }) {
  return (
    <div className="asst-panel asst-chat">
      <div className="asst-panel-head">
        <span className="asst-kicker">💬 Live Chat</span>
      </div>
      {chat.length === 0 ? (
        <p className="muted">Chat is quiet…</p>
      ) : (
        <ul className="asst-chat-list">
          {chat.map((m) => (
            <li key={m.key}>
              <span className="asst-chat-user">{m.user}:</span> {m.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
