"use client";

import { useState, useRef, useEffect } from "react";
import { FaceSmile as Bot, Loading01 as Loader2, MessageSquare01 as MessageSquare, Send01 as Send, Stars01 as Sparkles, User01 as User } from "@untitledui/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Create a study plan for mid-semester exams",
  "Explain the difference between SQL and NoSQL",
  "What is the best way to handle overlapping deadlines?",
  "Suggest a memory technique for formulas"
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your Quill AI study assistant. How can I help you organize your schedule, explain academic topics, or prepare for exams today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Send the entire chat history for context
      const conversationContext = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post<{ reply: string }>("/api/ai/chat", {
        messages: conversationContext
      });

      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that message right now. Please try again in a moment."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            Uki AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">Your smart study companion. Ask anything.</p>
        </div>
      </div>

      {/* Main chat container */}
      <div className="flex-1 bg-white/60 backdrop-blur-xl border border-white/40 rounded-[24px] shadow-sm overflow-hidden flex flex-col min-h-[400px] relative">
        {/* Decorative background gradient */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Chat History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 relative z-10 scrollbar-thin">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3.5 max-w-[85%] ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                msg.role === "user" 
                  ? "bg-foreground text-background" 
                  : "bg-gradient-to-tr from-primary to-primary/80 text-white"
              }`}>
                {msg.role === "user" ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
              </div>
              <div className={`p-4 rounded-[16px] text-sm leading-relaxed shadow-sm ${
                msg.role === "user" 
                  ? "bg-foreground text-background rounded-tr-sm whitespace-pre-wrap" 
                  : "bg-white border border-black/5 text-foreground rounded-tl-sm backdrop-blur-md prose prose-sm max-w-none"
              }`}>
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3.5 max-w-[80%] mr-auto items-center animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary/80 text-white flex items-center justify-center shadow-sm">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="p-4 bg-white border border-black/5 rounded-[16px] rounded-tl-sm flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Prompts */}
        {messages.length === 1 && (
          <div className="p-5 bg-white/50 border-t border-black/5 backdrop-blur-md z-10">
            <p className="text-xs font-bold text-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-1.5 ml-1">
              <Sparkles className="w-4 h-4 text-primary" />
              Try asking about
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSendMessage(s)}
                  className="group text-left px-4 py-3 bg-white border border-black/5 rounded-[12px] text-sm text-foreground/70 hover:text-foreground hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="truncate font-medium">{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-5 bg-white/80 border-t border-black/5 backdrop-blur-xl z-10">
          <div className="relative flex items-center bg-white border border-black/10 rounded-full shadow-sm hover:border-primary/30 transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <input
              type="text"
              aria-label="Ask Uki anything"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage(input)}
              placeholder="Ask Uki anything..."
              className="flex-1 px-6 py-4 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              type="button"
              aria-label="Send message"
              onClick={() => handleSendMessage(input)}
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2.5 bg-foreground text-background rounded-full hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-foreground disabled:hover:text-background cursor-pointer"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest font-medium">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
