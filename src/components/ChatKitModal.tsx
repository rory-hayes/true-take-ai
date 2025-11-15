import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import type { ChatKitOptions } from "@openai/chatkit";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatKitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatKitModal({ open, onOpenChange }: ChatKitModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-openai`;
  const chatkitContainerRef = useRef<HTMLDivElement>(null);
  const chatkitLoadedRef = useRef<boolean>(false);
  const [useEmbeddedChatKit, setUseEmbeddedChatKit] = useState<boolean>(true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Attempt to load and mount the official ChatKit widget on open.
  useEffect(() => {
    const mountChatKit = async () => {
      if (!open || chatkitLoadedRef.current || !chatkitContainerRef.current || !useEmbeddedChatKit) {
        return;
      }

      try {
        // Get user access token for server auth
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          // Fall back to custom UI
          setUseEmbeddedChatKit(false);
          return;
        }

        // Inject ChatKit script from CDN if not present
        const globalAny = window as any;
        const hasGlobal = typeof globalAny.ChatKit !== "undefined";
        if (!hasGlobal) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-chatkit]');
            if (existing) {
              existing.addEventListener("load", () => resolve());
              existing.addEventListener("error", () => reject(new Error("ChatKit script failed to load")));
            } else {
              const script = document.createElement("script");
              script.src = "https://cdn.openai.com/chatkit/chatkit.min.js";
              script.async = true;
              script.defer = true;
              script.setAttribute("data-chatkit", "true");
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("ChatKit script failed to load"));
              document.body.appendChild(script);
            }
          });
        }

        if (typeof globalAny.ChatKit === "undefined") {
          // Fallback to custom UI if widget not available
          setUseEmbeddedChatKit(false);
          return;
        }

        // Try to get a native ChatKit client token from our server
        const sessionResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatkit-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });

        let clientToken: string | null = null;
        if (sessionResp.ok) {
          const sessionJson = await sessionResp.json().catch(() => ({}));
          clientToken = sessionJson?.clientToken || null;
        }

        // Build options: prefer native token; otherwise fallback to proxy URL
        const options: ChatKitOptions = {
          api: clientToken
            ? { clientToken }
            : {
                url: CHAT_URL,
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
              },
          // Wire client-side tools to our paid tool router
          onClientTool: async (invocation: any) => {
            try {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatkit-tools`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  toolId: invocation?.tool?.id || invocation?.toolId,
                  args: invocation?.args || {},
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || `Tool request failed (${res.status})`);
              }
              const json = await res.json().catch(() => ({}));
              return json?.result ?? null;
            } catch (err) {
              console.error("onClientTool error:", err);
              return { error: "Tool failed" };
            }
          },
          theme: {
            colorScheme: "light",
            radius: "pill",
            density: "normal",
            typography: {
              baseSize: 16,
              fontFamily:
                '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
              fontFamilyMono:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
              fontSources: [
                {
                  family: "OpenAI Sans",
                  src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
                  weight: 400,
                  style: "normal",
                  display: "swap",
                },
              ],
            },
          },
          composer: {
            attachments: { enabled: true, maxCount: 5, maxSize: 10_485_760 },
            tools: [
              {
                id: "search_docs",
                label: "Search docs",
                shortLabel: "Docs",
                placeholderOverride: "Search documentation",
                icon: "book-open",
                pinned: false,
              },
            ],
          },
          startScreen: {
            greeting: "",
            prompts: [
              { icon: "circle-question", label: "What is ChatKit?", prompt: "What is ChatKit?" },
            ],
          },
        };

        // Mount the widget
        const instance = new globalAny.ChatKit(options);
        instance.render(chatkitContainerRef.current);
        chatkitLoadedRef.current = true;
      } catch (e) {
        console.error("Failed to mount ChatKit widget:", e);
        // Fallback to custom UI
        setUseEmbeddedChatKit(false);
      }
    };

    mountChatKit();
  }, [open, useEmbeddedChatKit]);

  const streamChat = async (userMessage: Message) => {
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("You must be signed in to use ChatKit.");
        setIsLoading(false);
        return;
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass the user's JWT so the Edge Function can authorize and enforce paid plans
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          setError("Rate limit exceeded. Please wait a moment and try again.");
        } else if (response.status === 402) {
          setError("AI service requires additional credits. Please contact support.");
        } else {
          setError(errorData.error || "Failed to get response. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Process any remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return newMessages;
              });
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setError("Connection error. Please check your internet and try again.");
      // Remove the placeholder assistant message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    await streamChat(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI ChatKit</DialogTitle>
        </DialogHeader>

        {error && !useEmbeddedChatKit && (
          <Alert variant="destructive" className="mb-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* If widget loads, render into this container. Otherwise, fall back to the custom UI below. */}
        {useEmbeddedChatKit ? (
          <div className="flex-1" ref={chatkitContainerRef} />
        ) : (
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p className="mb-2">Welcome to AI ChatKit!</p>
                  <p className="text-sm">Ask me anything about your payslips or tax information.</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {!useEmbeddedChatKit && (
          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
              aria-label="Chat message input"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
