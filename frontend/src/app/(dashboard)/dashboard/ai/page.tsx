"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  AlertCircle,
  FaceSmile as Bot,
  Loading01 as Loader2,
  Menu01 as Menu,
  MessageSquare01 as MessageSquare,
  RefreshCcw01 as RefreshCw,
  Send01 as Send,
  Stars01 as Sparkles,
  StopCircle,
  User01 as User,
} from "@untitledui/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { useEscape } from "@/hooks/useEscape";
import type { AiConversation, AiMessage } from "@/features/types";
import { streamConversationMessage } from "@/features/ai/streamChat";
import { ConversationSidebar } from "@/features/ai/components/ConversationSidebar";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I am your Quill AI study assistant. How can I help you organize your schedule, explain academic topics, or prepare for exams today?",
};

const suggestions = [
  "Create a study plan for mid-semester exams",
  "Explain the difference between SQL and NoSQL",
  "What is the best way to handle overlapping deadlines?",
  "Suggest a memory technique for formulas",
];

function deriveTitleFromPrompt(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}

export default function AiAssistantPage() {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEscape(drawerOpen, () => setDrawerOpen(false));

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchMessagesFor = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setErrorMsg(null);
    setLastFailedPrompt(null);
    try {
      const res = await api.get<{ messages: AiMessage[] }>(
        `/api/ai/conversations/${conversationId}/messages`
      );
      if (res.messages.length === 0) {
        setMessages([WELCOME_MESSAGE]);
      } else {
        setMessages(
          res.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load messages.");
      setMessages([WELCOME_MESSAGE]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const res = await api.get<{ conversations: AiConversation[] }>(
          "/api/ai/conversations"
        );
        if (cancelled) return;
        setConversations(res.conversations);
        if (res.conversations.length > 0) {
          const firstId = res.conversations[0].id;
          setActiveId(firstId);
          await fetchMessagesFor(firstId);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Failed to load conversations."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingConvs(false);
        }
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [fetchMessagesFor]);

  const handleSelectConversation = (id: string) => {
    if (streaming) {
      abortRef.current?.abort();
    }
    setActiveId(id);
    void fetchMessagesFor(id);
  };

  const handleCreateConversation = async (initialTitle?: string) => {
    setCreatingConv(true);
    setErrorMsg(null);
    try {
      const res = await api.post<{ conversation: AiConversation }>(
        "/api/ai/conversations",
        { title: initialTitle || "New chat" }
      );
      const created = res.conversation;
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      setMessages([WELCOME_MESSAGE]);
      setLastFailedPrompt(null);
      setDrawerOpen(false);
      return created;
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not create conversation."
      );
      return null;
    } finally {
      setCreatingConv(false);
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    const res = await api.patch<{ conversation: AiConversation }>(
      `/api/ai/conversations/${id}`,
      { title }
    );
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? res.conversation : c))
    );
  };

  const handleDeleteConversation = async (id: string) => {
    await api.delete(`/api/ai/conversations/${id}`);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        const nextActive = next[0]?.id ?? null;
        setActiveId(nextActive);
        if (nextActive) {
          void fetchMessagesFor(nextActive);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      }
      return next;
    });
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async (text: string, isRetry = false) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setErrorMsg(null);
    setLastFailedPrompt(null);

    let targetId = activeId;
    if (!targetId) {
      const created = await handleCreateConversation(deriveTitleFromPrompt(trimmed));
      if (!created) return;
      targetId = created.id;
    }

    if (!isRetry) {
      setInput("");
    }

    const userMsgId = `local-user-${Date.now()}`;
    const assistantMsgId = `local-assistant-${Date.now()}`;

    setMessages((prev) => {
      const base = prev.filter((m) => m.id !== "welcome");
      const nextBase: ChatMessage[] = isRetry
        ? base
        : [...base, { id: userMsgId, role: "user", content: trimmed }];
      return [...nextBase, { id: assistantMsgId, role: "assistant", content: "" }];
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    try {
      const result = await streamConversationMessage(targetId, trimmed, {
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
            )
          );
        },
      });

      if (result.messageId) {
        const savedId = result.messageId;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, id: savedId } : m))
        );
      }

      // Move active conversation to top of list
      setConversations((prev) => {
        const current = prev.find((c) => c.id === targetId);
        if (!current) return prev;
        const updated = { ...current, updated_at: new Date().toISOString() };
        return [updated, ...prev.filter((c) => c.id !== targetId)];
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantMsgId && m.content.length === 0))
        );
      } else {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantMsgId && m.content.length === 0))
        );
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Sorry, I couldn't process that message right now. Please try again."
        );
        setLastFailedPrompt(trimmed);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setStreaming(false);
    }
  };

  const handleRetry = () => {
    if (!lastFailedPrompt || streaming) return;
    void sendMessage(lastFailedPrompt, true);
  };

  const activeConversation = conversations.find((c) => c.id === activeId);
  const showSuggestions =
    !loadingMessages &&
    messages.length === 1 &&
    messages[0].id === "welcome";

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-100px)] min-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open conversations"
            className="md:hidden p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {activeConversation ? activeConversation.title : "Uki AI Assistant"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Your smart study companion. Conversations are saved automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Main layout: Sidebar + Chat */}
      <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex min-h-0 relative">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col min-h-0">
          <ConversationSidebar
            conversations={conversations}
            activeId={activeId}
            loading={loadingConvs}
            creating={creatingConv}
            onSelect={handleSelectConversation}
            onCreate={() => void handleCreateConversation()}
            onRename={handleRenameConversation}
            onDelete={handleDeleteConversation}
          />
        </aside>

        {/* Mobile Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Saved conversations"
              className="relative z-10 w-72 max-w-[85vw] h-full bg-card border-r border-border shadow-xl"
            >
              <ConversationSidebar
                conversations={conversations}
                activeId={activeId}
                loading={loadingConvs}
                creating={creatingConv}
                onSelect={handleSelectConversation}
                onCreate={() => void handleCreateConversation()}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                onCloseDrawer={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 scrollbar-thin">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading messages...</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      msg.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed shadow-sm min-w-0 ${
                      msg.role === "user"
                        ? "bg-foreground text-background rounded-tr-sm whitespace-pre-wrap"
                        : "bg-muted/50 border border-border text-foreground rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
                    }`}
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : msg.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Thinking...</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error + Retry banner */}
          {errorMsg && (
            <div
              role="alert"
              className="mx-4 sm:mx-6 mb-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={streaming}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* Suggestion Prompts */}
          {showSuggestions && (
            <div className="p-4 sm:p-5 bg-muted/30 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5 ml-1">
                <Sparkles className="w-4 h-4 text-primary" />
                Try asking about
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage(s)}
                    className="group text-left px-3.5 py-2.5 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer flex items-center gap-2.5"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate font-medium">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 sm:p-4 bg-card border-t border-border">
            <div className="relative flex items-center bg-background border border-border rounded-full shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <input
                type="text"
                aria-label="Ask Uki anything"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask Uki anything..."
                className="flex-1 min-w-0 pl-5 pr-14 py-3 sm:py-3.5 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                disabled={streaming || loadingMessages}
              />
              {streaming ? (
                <button
                  type="button"
                  aria-label="Stop generating"
                  onClick={handleStopStreaming}
                  className="absolute right-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-full hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Send message"
                  onClick={() => void sendMessage(input)}
                  disabled={loadingMessages || !input.trim()}
                  className="absolute right-2 p-2 bg-foreground text-background rounded-full hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2 uppercase tracking-widest font-medium">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
