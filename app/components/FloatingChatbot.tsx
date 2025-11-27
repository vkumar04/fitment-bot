"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import imageCompression from "browser-image-compression";
import Image from "next/image";

// Analytics helper functions that call the API
async function startSession(
  sessionId: string,
  source: string,
  sourceDomain?: string,
) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start_session",
        sessionId,
        data: { source, sourceDomain },
      }),
    });
  } catch (error) {
    console.error("Failed to start session:", error);
  }
}

async function endSession(sessionId: string, sentiment?: number) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "end_session",
        sessionId,
        data: { sentiment },
      }),
    });
  } catch (error) {
    console.error("Failed to end session:", error);
  }
}

async function trackMessage(
  sessionId: string,
  role: string,
  contentLength: number,
) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "track_message",
        sessionId,
        data: { role, contentLength },
      }),
    });
  } catch (error) {
    console.error("Failed to track message:", error);
  }
}

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );

  // Render text with HTML anchor tags as clickable links
  const renderTextWithLinks = (text: string) => {
    // Match HTML anchor tags: <a href="url" target="_blank">text</a>
    const linkRegex =
      /<a\s+href=['"]([^'"]+)['"](?:\s+target=['"]_blank['"])?>([^<]+)<\/a>/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the link as a clickable React element
      const url = match[1];
      const linkText = match[2];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
        >
          {linkText}
        </a>,
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Initialize analytics on mount
  useEffect(() => {
    // Detect if we're in an iframe (Shopify embed)
    const isEmbedded =
      typeof window !== "undefined" && window.parent !== window;
    let source = "standalone";
    let sourceDomain: string | undefined;

    if (isEmbedded) {
      source = "shopify";
      // Try to get parent domain (will be blocked by CORS, but we can try)
      try {
        sourceDomain = document.referrer
          ? new URL(document.referrer).hostname
          : undefined;
      } catch (e) {
        // CORS blocked, that's okay
        sourceDomain = "shopify-store";
      }
    }

    startSession(sessionId, source, sourceDomain);
  }, [sessionId]);

  // End session on unmount
  useEffect(() => {
    return () => {
      if (messages.length > 0) {
        endSession(sessionId);
      }
    };
  }, [sessionId, messages.length]);

  // Communicate with parent window when embedded in iframe
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent !== window) {
      if (isOpen) {
        // Chat is open - iframe needs to be large
        window.parent.postMessage({ type: "chatbot", isOpen: true }, "*");
      } else {
        // Chat is closed - iframe can be small (just the button)
        window.parent.postMessage({ type: "chatbot", isOpen: false }, "*");
      }
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive and track messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Track new messages
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const contentLength = lastMessage.parts
        .filter((p) => p.type === "text")
        .reduce((sum, p) => sum + (p.text?.length || 0), 0);

      trackMessage(
        sessionId,
        lastMessage.role as "user" | "assistant",
        contentLength,
      );
    }
  }, [messages, sessionId]);

  // Compress image before upload
  async function compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 1, // Max 1MB
      maxWidthOrHeight: 1024, // Max 1024px
      useWebWorker: true,
      fileType: file.type,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      return file; // Return original if compression fails
    }
  }

  // Convert files to data URLs
  async function convertFilesToDataURLs(files: File[]) {
    // Compress images first
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

    const parts: Array<{
      type: string;
      text?: string;
      mediaType?: string;
      url?: string;
    }> = [];

    // Add text if present
    if (input.trim()) {
      parts.push({ type: "text", text: input });
    }

    // Add files if present
    if (selectedFiles.length > 0) {
      const fileParts = await convertFilesToDataURLs(selectedFiles);
      parts.push(...fileParts);
    }

    sendMessage({
      role: "user",
      parts: parts as any,
    });

    setInput("");
    setSelectedFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    // Limit to 3 images
    if (imageFiles.length > 3) {
      alert("Max 3 images per message");
      return;
    }

    setSelectedFiles(imageFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick action for common vehicles
  const handleQuickAction = (vehicle: string) => {
    setInput(vehicle);
  };

  const isLoading = status === "streaming" || status === "submitted";

  // Popular vehicles for quick actions
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-full shadow-xl flex items-center justify-center z-50 transition-all duration-300 hover:scale-110"
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[80vh] bg-linear-to-b from-gray-900 to-black rounded-lg shadow-2xl flex flex-col z-50 border border-gray-800">
          {/* Header */}
          <div className="bg-linear-to-r from-gray-800 to-gray-900 text-white p-4 rounded-t-lg flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-gray-100">
                Kansei Fitment Assistant
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-700 rounded p-1 transition-colors"
              aria-label="Close chat"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-4">
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-semibold mb-2 text-gray-300">
                  Kansei Fitment Help
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Upload a pic or ask about wheels
                </p>

                {/* Quick Action Buttons */}
                <div className="mt-4">
                  <p className="text-xs text-gray-600 mb-2">
                    Popular vehicles:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {popularVehicles.map((vehicle) => (
                      <button
                        key={vehicle.value}
                        onClick={() => handleQuickAction(vehicle.value)}
                        className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
                      >
                        {vehicle.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Bot Avatar */}
                {m.role === "assistant" && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-white border border-gray-600 flex items-center justify-center overflow-hidden">
                    <Image
                      src="/kansei-logo.png"
                      alt="Kansei"
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-lg px-4 py-3 ${
                    m.role === "user"
                      ? "bg-linear-to-r from-gray-700 to-gray-800 text-white shadow-lg"
                      : "bg-gray-800 text-gray-100 border border-gray-700"
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

                {/* User Avatar */}
                {m.role === "user" && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 border border-gray-500 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-200"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex justify-center">
                <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg px-4 py-2 text-sm">
                  Failed to send message. Please try again.
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {selectedFiles.length > 0 && (
            <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
              <div className="flex gap-2 overflow-x-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 object-cover rounded border border-gray-700"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-400 mt-1">
                💡 For best results: side profile, clear wheel view
              </p>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-gray-800 bg-gray-900 rounded-b-lg"
          >
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 transition-colors"
                disabled={isLoading}
                title="Upload car image (max 3)"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What's your ride?"
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={
                  isLoading || (!input.trim() && selectedFiles.length === 0)
                }
                className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 disabled:from-gray-800 disabled:to-gray-900 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
