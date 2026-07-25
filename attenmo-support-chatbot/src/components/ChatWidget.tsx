import React, { useState, useRef, useEffect } from "react";
import { Message, WidgetConfig } from "../types";
import { 
  MessageSquare, 
  X, 
  Send, 
  RotateCcw, 
  ArrowDown, 
  Sparkles,
  User,
  ExternalLink,
  HelpCircle,
  Clock,
  ThumbsUp,
  AlertTriangle,
  Paperclip,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatWidgetProps {
  config: WidgetConfig;
  isOpenOnInit?: boolean;
  inlineMode?: boolean; // if true, renders directly inline rather than bottom floating
  onChatMessageSent?: (text: string) => void;
  onChatMessageReceived?: (text: string) => void;
}

export default function ChatWidget({
  config,
  isOpenOnInit = false,
  inlineMode = false,
  onChatMessageSent,
  onChatMessageReceived
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(isOpenOnInit);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; mimeType: string; base64: string; } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit. Please upload a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result as string;
      const commaIndex = resultStr.indexOf(",");
      if (commaIndex !== -1) {
        const base64 = resultStr.substring(commaIndex + 1);
        setPendingAttachment({
          name: file.name,
          mimeType: file.type || "image/png",
          base64: base64
        });
      }
    };
    reader.readAsDataURL(file);
    
    // Clear value so selection triggers change event even for same file
    e.target.value = "";
  };

  // Initialize state with stored messages if any, otherwise welcome msg
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem("attenmo_chat_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Map timestamps back to Date objects safely
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        }
      }
    } catch (e) {
      console.error("Failed to parse stored chat history:", e);
    }
    
    // Default welcome
    return [
      {
        id: "welcome",
        role: "assistant",
        content: config.welcomeMessage,
        timestamp: new Date()
      }
    ];
  });

  // Save messages to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("attenmo_chat_history", JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history to local storage:", e);
    }
  }, [messages]);

  // Synchronize welcome message configuration if user has only default welcome message
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [
          {
            id: "welcome",
            role: "assistant",
            content: config.welcomeMessage,
            timestamp: prev[0].timestamp || new Date()
          }
        ];
      }
      return prev;
    });
  }, [config.welcomeMessage]);

  const resetChat = () => {
    const defaultWelcome = [
      {
        id: "welcome",
        role: "assistant",
        content: config.welcomeMessage,
        timestamp: new Date()
      }
    ];
    setMessages(defaultWelcome);
    try {
      localStorage.setItem("attenmo_chat_history", JSON.stringify(defaultWelcome));
    } catch (e) {
      console.error("Failed to reset stored chat history:", e);
    }
  };

  const handleEscalateEmail = () => {
    const supportEmail = "attenmo.tech@gmail.com";
    const subject = encodeURIComponent("[AttenMo Support] Help / Escalation Request");
    
    // Find latest user query and latest bot reply
    const userMsgs = messages.filter(m => m.role === "user");
    const botMsgs = messages.filter(m => m.role === "assistant" && m.id !== "welcome");
    const lastUserQuery = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : "No messages recorded yet";
    const lastAIResponse = botMsgs.length > 0 ? botMsgs[botMsgs.length - 1].content : "Welcome greeting initiated";

    let bodyDraft = "Dear AttenMo Support,\n\nI need further human support to resolve my issue:\n\n";
    bodyDraft += `--- CHAT WORKFLOW CONTEXT ---\n`;
    bodyDraft += `[Last User Message]: ${lastUserQuery}\n\n`;
    bodyDraft += `[Associated Agent Response]: ${lastAIResponse}\n`;
    bodyDraft += `-----------------------------\n\n`;
    bodyDraft += "Please enter additional details to help speed up verification:\n";
    bodyDraft += "- Name: \n";
    bodyDraft += "- Roll Number: \n";
    bodyDraft += "- Class ID: \n\n";
    bodyDraft += "Thank you,\nAttenMo User";

    const body = encodeURIComponent(bodyDraft);
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 60);
    }
  }, [isOpen, messages, isLoading]);

  const handleScroll = () => {
    if (!chatBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
  };

  const handleSendMessage = async (text: string = inputValue) => {
    const trimmed = text.trim();
    if ((!trimmed && !pendingAttachment) || isLoading) return;

    if (text === inputValue) {
      setInputValue("");
    }

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: trimmed || "Uploaded screenshot/image",
      timestamp: new Date()
    };

    if (pendingAttachment) {
      userMsg.attachment = pendingAttachment;
      setPendingAttachment(null);
    }

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    if (onChatMessageSent) {
      onChatMessageSent(userMsg.content);
    }

    try {
      // Map message structure to what server endpoint expects: list of model/user roles + attachment contexts.
      // Only send the latest 10 messages to avoid hitting the backend MAX_MESSAGES limit.
      const apiMessages = newMessages.slice(-10).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        attachment: m.attachment
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to communicate with support agent.");
      }

      // Read output stream
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available.");
      }

      const decoder = new TextDecoder("utf-8");
      let botContent = "";
      const botMsgId = `bot-${Date.now()}`;

      // Insert an empty assistant message to write into
      setMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date()
        }
      ]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Save the last partial line back to the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                botContent += parsed.text;
                // Update the assistant message content of the active message
                setMessages(prev => 
                  prev.map(m => m.id === botMsgId ? { ...m, content: botContent } : m)
                );
              }
            } catch (err) {
              console.error("Error parsing stream line:", err);
            }
          }
        }
      }

      if (onChatMessageReceived) {
        onChatMessageReceived(botContent);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant", // render as bot warning
        content: `⚠️ Error: ${err.message || "Failed to connect to the backing AI Support service. Please check that GEMINI_API_KEY is configured in your Secrets Panel and attempt to rebuild/restart."}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Extract color tokens safely
  const primaryBg = config.primaryColor;
  const accentColor = config.accentColor;

  // Simple clean utility to split text into markdown-style paragraphs and bullets for simple layout
  const renderMessageContent = (content: string) => {
    if (content.startsWith("⚠️ Error:")) {
      return (
        <div className="text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 text-xs flex mt-1 items-start gap-1.5 leading-relaxed font-mono">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{content.replace("⚠️ Error: ", "")}</span>
        </div>
      );
    }

    const lines = content.split("\n");
    return (
      <div className="space-y-2 text-[13px] leading-relaxed">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1.5" />;

          // Bullets
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <ul key={i} className="list-disc pl-4 space-y-1 my-1">
                <li className="text-inherit">{trimmed.substring(2)}</li>
              </ul>
            );
          }

          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <ol key={i} className="list-decimal pl-4 space-y-1 my-1">
                <li className="text-inherit">{numMatch[2]}</li>
              </ol>
            );
          }

          // Blockquote or notes
          if (trimmed.startsWith(">")) {
            return (
              <p key={i} className="italic border-l-2 pl-2.5 my-1.5 border-slate-300 opacity-90 text-inherit text-xs">
                {trimmed.substring(1).trim()}
              </p>
            );
          }

          // Regular text
          return <p key={i} className="text-inherit font-light">{trimmed}</p>;
        })}
      </div>
    );
  };

  const formatMsgTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper chips to quickly test inside widget
  const suggestions = [
    { label: "My QR says invalid", value: "My QR says invalid or expired" },
    { label: "Phone OTP help", value: "Phone login OTP is not coming" },
    { label: "GPS mismatch", value: "I am getting geofence/location mismatch" },
    { label: "Export Hub", value: "How do I export class attendance?" }
  ];

  const chatContainerLayout = inlineMode 
    ? "w-full h-full flex flex-col bg-white border border-slate-100 shadow-md " + config.borderRadius
    : `fixed ${config.position === "bottom-right" ? "bottom-5 right-5" : "bottom-5 left-5"} w-[360px] md:w-[380px] h-[550px] flex flex-col bg-white shadow-2xl border border-slate-100 z-50 overflow-hidden ` + config.borderRadius;

  const triggerIconSize = "w-6 h-6";

  return (
    <>
      {/* Floating launcher trigger (Only if not inlineMode) */}
      {!inlineMode && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed ${config.position === "bottom-right" ? "bottom-5 right-5" : "bottom-5 left-5"} w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-transform z-40`}
          style={{ backgroundColor: primaryBg }}
          id="attenmo-support-launcher"
        >
          {isOpen ? (
            <X className={triggerIconSize} />
          ) : (
            <div className="relative">
              <MessageSquare className={triggerIconSize} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-400 border-2 border-white rounded-full animate-ping" />
            </div>
          )}
        </button>
      )}

      {/* Widget Content Pane */}
      {(!inlineMode ? isOpen : true) && (
        <div 
          className={chatContainerLayout}
          id="attenmo-support-widget-panel"
        >
          {/* Header Panel */}
          <div 
            className="px-4 py-3 flex items-center justify-between text-white shrink-0 shadow-sm relative overflow-hidden" 
            style={{ backgroundImage: `linear-gradient(135deg, ${primaryBg}, ${accentColor})` }}
          >
            {/* Ambient pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-indigo-200 to-indigo-900 pointer-events-none" />
            
            <div className="flex items-center gap-2.5 z-10">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Sparkles className="w-4 h-4 text-white animated-pulse" />
              </div>
              <div>
                <h3 className="font-display font-medium text-sm tracking-wide flex items-center gap-1">
                  {config.headerTitle}
                </h3>
                <div className="text-[10px] text-indigo-100 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span>AI Agent Online &bull; AttenMo Base</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 z-10">
              <button 
                onClick={handleEscalateEmail} 
                className="px-2.5 py-1 text-[11px] font-medium bg-white/15 hover:bg-white/25 text-white rounded-md transition-colors flex items-center gap-1 cursor-pointer font-sans"
                title="Escalate issue to human support"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Talk to Support</span>
              </button>

              <button 
                onClick={resetChat} 
                className="p-1.5 h-7 w-7 rounded-md hover:bg-white/10 text-white transition-colors flex items-center justify-center cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              
              {!inlineMode && (
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1.5 h-7 w-7 rounded-md hover:bg-white/10 text-white transition-colors flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Body */}
          <div 
            ref={chatBodyRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70 relative"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* Brand watermark or helper info */}
            <div className="text-center pb-2 opacity-50 select-none">
              <p className="text-[10.5px] text-slate-400 font-mono">
                Support restricted to Allowed Origin &bull; attenmo.web.app
              </p>
            </div>

            {messages.map((msg) => {
              const isBot = msg.role === "assistant";
              return (
                <div 
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isBot ? "" : "flex-row-reverse"}`}
                >
                  {/* Avatar bubble */}
                  {isBot ? (
                    <div 
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs shrink-0 select-none font-medium"
                      style={{ backgroundImage: `linear-gradient(135deg, ${primaryBg}, ${accentColor})` }}
                    >
                      A
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0 select-none border border-slate-350">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}

                  {/* Bubble wrapper */}
                  <div className="max-w-[78%] flex flex-col">
                    <div 
                      className={`px-3 py-2 ${
                        isBot 
                          ? "bg-white text-slate-800 rounded-tr-xl rounded-br-xl rounded-bl-sm shadow-sm border border-slate-100" 
                          : "text-white rounded-tl-xl rounded-bl-xl rounded-tr-sm shadow-sm"
                      }`}
                      style={!isBot ? { backgroundColor: primaryBg } : undefined}
                    >
                      {renderMessageContent(msg.content)}

                      {msg.attachment && (
                        <div className={`mt-2 pt-1.5 border-t ${isBot ? "border-slate-150" : "border-white/10"}`}>
                          <img 
                            src={`data:${msg.attachment.mimeType};base64,${msg.attachment.base64}`} 
                            alt={msg.attachment.name}
                            className="max-h-40 rounded-lg border border-black/10 shadow-sm cursor-pointer object-cover w-full scale-100 hover:scale-[1.02] active:scale-95 transition-transform"
                            referrerPolicy="no-referrer"
                            onClick={() => setZoomedImage(`data:${msg.attachment?.mimeType};base64,${msg.attachment?.base64}`)}
                          />
                          <p className={`text-[9px] mt-1 italic font-mono truncate max-w-full ${isBot ? "text-slate-400" : "text-white/70"}`}>
                            📎 {msg.attachment.name}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Timestamp */}
                    <span className={`text-[9px] text-slate-400 mt-1 ${!isBot ? "text-right" : "text-left"}`}>
                      {formatMsgTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* AI Generation Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2.5 animate-pulse">
                <div 
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs shrink-0 select-none"
                  style={{ backgroundImage: `linear-gradient(135deg, ${primaryBg}, ${accentColor})` }}
                >
                  A
                </div>
                <div className="bg-white text-slate-800 px-3.5 py-2.5 rounded-tr-xl rounded-br-xl rounded-bl-sm shadow-sm border border-slate-100">
                  <div className="flex gap-1.5 items-center justify-center py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Shelf */}
          {messages.length === 1 && suggestions.length > 0 && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.value)}
                  className="text-[11px] font-medium text-indigo-700 bg-indigo-55/70 hover:bg-indigo-100 border border-indigo-200/50 py-1 px-2.5 rounded-full text-left transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Floater Bottom Scroll Marker */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-16 right-4 p-1.5 rounded-full bg-white text-slate-600 shadow-md border border-slate-100 hover:text-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}

          {/* Reply Form Footer */}
          {pendingAttachment && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 z-10 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <div className="w-8 h-8 rounded border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                  <img 
                    src={`data:${pendingAttachment.mimeType};base64,${pendingAttachment.base64}`} 
                    alt="Pending upload" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="truncate">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{pendingAttachment.name}</p>
                  <p className="text-[9px] text-indigo-500 capitalize flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                    Pending Attachment
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPendingAttachment(null)}
                className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors border border-slate-200/70 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Attach screenshot or photo"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your support question..."
              rows={1}
              className="flex-1 bg-slate-50 hover:bg-slate-50/40 focus:bg-white text-xs text-slate-800 border border-slate-200 focus:border-slate-350 focus:ring-1 focus:ring-slate-350/50 py-2 px-3 rounded-lg outline-none resize-none max-h-20 min-h-[34px] font-sans"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={(!inputValue.trim() && !pendingAttachment) || isLoading}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm transition-all focus:ring-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              style={{ backgroundColor: primaryBg }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-slide shrink-0" />
        </div>
      )}

      {/* Lightbox zoomed image view */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 cursor-pointer animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImage} 
              alt="Zoomed attachment" 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-white/20"
              referrerPolicy="no-referrer"
            />
            <button 
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 border border-white/30 text-white flex items-center justify-center hover:bg-slate-800 shadow-md cursor-pointer"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
