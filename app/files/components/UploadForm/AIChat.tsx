"use client";

import React, { useState, useRef, useEffect } from "react";
import { SendIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface AIChatProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
}

export function AIChat({ onSendMessage, isLoading }: AIChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: '¿Hay algo que deba corregir? Puedo invertir signos o ignorar líneas específicas.' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      await onSendMessage(userMsg);
      setMessages(prev => [...prev, { role: 'ai', content: 'He actualizado los datos basándome en tu feedback.' }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error.message}` }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Asistente IA</span>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${msg.role === 'user'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-sm'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3 py-2 text-[11px] text-zinc-400 flex items-center gap-2 shadow-sm">
                <Loader2Icon className="h-3 w-3 animate-spin" />
                Procesando cambios...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
        <div className="relative group flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ej: Invierte los signos..."
            rows={1}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl py-2.5 pl-4 pr-10 text-[11px] placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none min-h-[38px] max-h-[120px] overflow-y-auto"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-1.5 p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-30"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
