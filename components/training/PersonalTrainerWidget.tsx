'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Mic, Minimize2, Send, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface PersonalTrainerWidgetProps {
  initialMessages: Message[];
}

export function PersonalTrainerWidget({ initialMessages }: PersonalTrainerWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    setVoiceSupported(supported);
  }, []);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages]);

  const unreadCount = useMemo(() => {
    return messages.filter((m) => m.role === 'assistant').length;
  }, [messages]);

  const refreshMessages = async () => {
    const res = await fetch('/api/training/chat');
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);

    const message = input.trim();
    setInput('');

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch('/api/training/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        await refreshMessages();
      }
    } catch {
      await refreshMessages();
    } finally {
      setSending(false);
    }
  };

  const toggleVoice = () => {
    if (!voiceSupported) return;

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:bg-blue-400"
          title="Abrir Personal Trainer"
        >
          <MessageSquare className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/50 p-4 md:items-center md:justify-center">
          <div className="flex h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl md:h-[720px]">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/15 p-2">
                  <Bot className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-white">Personal Trainer</div>
                  <div className="text-xs text-zinc-400">Chat modal superpuesto · Gateway LLM</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700"
                  title="Minimizar"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-950 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] rounded-2xl border px-4 py-3 text-sm ${
                    message.role === 'assistant'
                      ? 'border-blue-500/20 bg-blue-500/10 text-zinc-100'
                      : 'ml-auto border-zinc-700 bg-zinc-800 text-white'
                  }`}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
                    {message.role === 'assistant' ? 'Coach' : 'Tú'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              ))}
              {sending && (
                <div className="max-w-[90%] rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-zinc-200">
                  El coach está pensando...
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-900 p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Pregunta por fatiga, carga, plan, nutrición o qué hacer hoy..."
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
                <button
                  onClick={toggleVoice}
                  disabled={!voiceSupported}
                  className={`rounded-xl px-3 py-3 text-white ${
                    listening ? 'bg-red-500 hover:bg-red-400' : 'bg-blue-500 hover:bg-blue-400'
                  } disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500`}
                  title={voiceSupported ? 'Dictado por voz' : 'Voz no soportada en este navegador'}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="rounded-xl bg-[#FC4C02] px-4 py-3 text-white hover:bg-[#e14602] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Voz: dictado del navegador preparado. Respuesta del coach vía Gateway LLM con fallback si falla.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
