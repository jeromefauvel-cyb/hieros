"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Message {
  id: string;
  content: string;
  direction: "in" | "out";
  created_at: string;
}

export default function TelegramChat({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/telegram/messages?user_id=${user.id}`);
    if (res.ok) setMessages(await res.json());
  }, [user.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);

    await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.trim(), user_id: user.id }),
    });

    setInput("");
    setSending(false);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[#33FF33]/15 flex items-center justify-between">
        <h2 className="font-marsek text-sm text-white tracking-widest">
          TELEGRAM
        </h2>
        <span className="text-[9px] text-[#33FF33]/40 tracking-wider">
          {user.user_metadata?.telegram_username ? `@${user.user_metadata.telegram_username}` : "NON CONNECTE"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-white/20 text-[10px] tracking-wider py-8">
            AUCUN MESSAGE
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === "in" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-3 py-1.5 text-[12px] ${
                msg.direction === "in"
                  ? "bg-[#33FF33]/10 border border-[#33FF33]/20 text-[#33FF33]/90"
                  : "bg-[#DF8301]/10 border border-[#DF8301]/20 text-[#DF8301]/90"
              }`}
            >
              <p className="break-words">{msg.content}</p>
              <p className={`text-[8px] mt-1 ${msg.direction === "in" ? "text-[#33FF33]/30 text-right" : "text-[#DF8301]/30"}`}>
                {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-[#33FF33]/15 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="MESSAGE..."
          className="flex-1 bg-black border border-[#33FF33]/30 text-white px-3 py-1.5 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/20"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1.5 text-[10px] hover:bg-[#33FF33]/10 transition-colors disabled:opacity-30 tracking-wider"
        >
          {sending ? "..." : "SEND"}
        </button>
      </form>
    </div>
  );
}
