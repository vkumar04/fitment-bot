"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  X,
  Image as ImageIcon,
  Send,
  Loader2,
  User,
  RotateCcw,
} from "lucide-react";

// Generate or retrieve session ID
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("chatbot_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("chatbot_session_id", sessionId);
  }
  return sessionId;
}

interface FloatingChatbotProps {
  shopDomain?: string;
}

export default function FloatingChatbot({
  shopDomain: propShopDomain = "unknown",
}: FloatingChatbotProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(getSessionId);
  const shopDomain = propShopDomain;

  const {
    messages,
    sendMessage: originalSendMessage,
    status,
    stop,
    setMessages,
  } = useChat();

  // Wrap sendMessage to track analytics
  const sendMessage = async (
    message: Parameters<typeof originalSendMessage>[0],
  ) => {
    if (!message) return;

    const content =
      message.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(" ") || "";
    const hasImages = message.parts?.some((p) => p.type === "file") || false;

    // Mark that we have a conversation (will be created in track endpoint)
    hasConversationRef.current = true;

    // Track user message
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        shopDomain,
        role: "user",
        content,
        hasImages,
      }),
    }).catch((err) => console.error("Track error:", err));

    return originalSendMessage(message);
  };

  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(stop);
  const statusRef = useRef(status);
  const hasConversationRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    stopRef.current = stop;
    statusRef.current = status;
  });

  // Track when a conversation has been created
  useEffect(() => {
    if (messages.length > 0) {
      hasConversationRef.current = true;
    }
  }, [messages.length]);

  // Render text with HTML anchor tags as clickable links
  const renderTextWithLinks = (text: string) => {
    const linkRegex =
      /<a\s+href=['"]([^'"]+)['"](?:\s+target=['"]_blank['"])?>([^<]+)<\/a>/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const url = match[1];
      const linkText = match[2];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {linkText}
        </a>,
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Communicate with parent window when embedded in iframe
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "chatbot", isOpen }, "*");
    }
  }, [isOpen]);

  // Stop streaming and mark conversation as inactive when chat is closed
  // Mark conversation as active when chat is opened
  useEffect(() => {
    if (!isOpen) {
      // Stop any active streaming
      if (
        statusRef.current === "streaming" ||
        statusRef.current === "submitted"
      ) {
        stopRef.current();
      }

      // Mark conversation as inactive (only if we've created one)
      if (hasConversationRef.current) {
        console.log("Deactivating conversation:", sessionId);
        fetch("/api/analytics/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).catch((err) => console.error("Deactivate error:", err));
      }
    } else {
      // Mark conversation as active when opened (only if we've created one)
      if (hasConversationRef.current) {
        console.log("Activating conversation:", sessionId);
        fetch("/api/analytics/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).catch((err) => console.error("Activate error:", err));
      }
    }
  }, [isOpen, sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Deactivate conversation when page is closed/refreshed
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasConversationRef.current) {
        console.log("Page unloading, deactivating conversation:", sessionId);
        // Use fetch with keepalive for reliable delivery during page unload
        fetch("/api/analytics/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          keepalive: true,
        }).catch((err) => console.error("Deactivate on unload error:", err));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  // Track assistant responses (only when complete)
  const lastTrackedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      status !== "streaming" &&
      lastTrackedMessageRef.current !== lastMessage.id
    ) {
      const content =
        lastMessage.parts
          ?.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(" ") || "";

      if (content.trim()) {
        lastTrackedMessageRef.current = lastMessage.id;

        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            shopDomain,
            role: "assistant",
            content,
            hasImages: false,
          }),
        }).catch((err) => console.error("Track error:", err));
      }
    }
  }, [messages, status, sessionId, shopDomain]);

  // Compress image before upload
  async function compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      fileType: file.type,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Error compressing image:", error);
      return file;
    }
  }

  // Convert files to data URLs
  async function convertFilesToDataURLs(files: File[]) {
    const compressedFiles = await Promise.all(
      files.map((file) => compressImage(file)),
    );

    return Promise.all(
      compressedFiles.map(
        (file) =>
          new Promise<{ type: "file"; mediaType: string; url: string }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  type: "file",
                  mediaType: file.type,
                  url: reader.result as string,
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            },
          ),
      ),
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      (!input.trim() && selectedFiles.length === 0) ||
      status === "streaming"
    ) {
      return;
    }

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string }
    > = [];

    if (input.trim()) {
      parts.push({ type: "text", text: input });
    }

    if (selectedFiles.length > 0) {
      const fileParts = await convertFilesToDataURLs(selectedFiles);
      parts.push(...fileParts);
    }

    sendMessage({
      role: "user",
      parts,
    });

    setInput("");
    setSelectedFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length > 3) {
      alert("Max 3 images per message");
      return;
    }

    setSelectedFiles(imageFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuickAction = (vehicle: string) => {
    setInput(vehicle);
  };

  const handleNewConversation = async () => {
    // Deactivate current conversation
    if (hasConversationRef.current) {
      await fetch("/api/analytics/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch((err) => console.error("Deactivate error:", err));
    }

    // Clear messages and input
    setMessages([]);
    setInput("");
    setSelectedFiles([]);

    // Reset conversation tracking
    hasConversationRef.current = false;

    // Generate new session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("chatbot_session_id", newSessionId);
    setSessionId(newSessionId);
  };

  const isLoading = status === "streaming" || status === "submitted";

  const popularVehicles = [
    { label: "BRZ / 86", value: "2024 BRZ" },
    { label: "Civic", value: "2023 Civic" },
    { label: "E46 BMW", value: "E46 BMW" },
    { label: "350Z", value: "350Z" },
    { label: "WRX", value: "2022 WRX" },
    { label: "Miata", value: "ND Miata" },
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[750px] max-h-[90vh] flex flex-col z-50 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <h3 className="font-semibold">Kansei Fitment Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewConversation}
                  title="New Conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages Container */}
          <ScrollArea className="flex-1 min-h-0 p-4 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center mt-4">
                <div className="mb-4 flex justify-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-2">
                  Kansei Fitment Help
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a pic or ask about wheels
                </p>

                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Popular vehicles:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {popularVehicles.map((vehicle) => (
                      <Badge
                        key={vehicle.value}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleQuickAction(vehicle.value)}
                      >
                        {vehicle.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Disclaimer - only shown on initial screen */}
                <div className="mt-8 px-4 pb-4">
                  <p className="text-[11px] leading-[1.5] text-muted-foreground/70 text-center">
                    All results are for informational purposes only. Fitment
                    must be independently verified. WheelPrice and partners are
                    not liable for any incorrect fitment or resulting costs or
                    damages.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src="/kansei-logo.png" alt="Kansei" />
                      <AvatarFallback>K</AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-3 break-words overflow-hidden ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <div
                            key={index}
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                          >
                            {renderTextWithLinks(part.text)}
                          </div>
                        );
                      }
                      if (
                        part.type === "file" &&
                        part.mediaType?.startsWith("image/")
                      ) {
                        return (
                          <div
                            key={index}
                            className="mt-2 relative w-full max-w-sm"
                          >
                            <Image
                              src={part.url}
                              alt="Uploaded car"
                              width={400}
                              height={300}
                              className="rounded-lg w-full h-auto"
                            />
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {m.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="flex justify-center">
                  <Badge variant="destructive">
                    Failed to send message. Please try again.
                  </Badge>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Image Preview */}
          {selectedFiles.length > 0 && (
            <div className="px-4 py-2 border-t flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 object-cover rounded border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-500 mt-1">
                💡 For best results: side profile, clear wheel view
              </p>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t flex gap-2 flex-shrink-0"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What's your ride?"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={
                isLoading || (!input.trim() && selectedFiles.length === 0)
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
