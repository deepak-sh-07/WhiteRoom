"use client";
// components/AISummaryPanel.jsx
// ─────────────────────────────
// Slide-in panel that streams an AI summary of the current
// docs + whiteboard content. Pass it the Yjs doc ref and it
// extracts text itself — zero extra wiring needed in Room.jsx
// beyond the single <AISummaryPanel> tag.
//
// Props:
//   ydocRef   – React ref pointing at the shared Y.Doc
//   isOpen    – boolean controlling visibility
//   onClose   – () => void
//   roomId    – string (used as panel subtitle)

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, RefreshCw, Copy, Check, FileText, Layout } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extract plain text from the Yjs doc.
 * Handles both Tiptap/ProseMirror (Y.XmlFragment "prosemirror")
 * and plain Y.Text "content" patterns commonly used by Yjs editors.
 */
function extractDocsText(ydoc) {
  if (!ydoc) return "";

  // Try Tiptap / Hocuspocus convention: Y.XmlFragment named "prosemirror"
  try {
    const xml = ydoc.get("prosemirror", null);
    if (xml && typeof xml.toString === "function") {
      // Strip XML tags, collapse whitespace
      return xml.toString().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  } catch {}

  // Try plain Y.Text named "content"
  try {
    const txt = ydoc.getText("content");
    if (txt) return txt.toString().trim();
  } catch {}

  // Try Y.Text named "document"
  try {
    const txt = ydoc.getText("document");
    if (txt) return txt.toString().trim();
  } catch {}

  return "";
}

/**
 * Extract whiteboard strokes as a human-readable description.
 * WhiteboardPanel typically stores strokes in a Y.Array named "strokes"
 * or "whiteboard". We describe the content quantitatively since raw
 * stroke coords aren't human-readable.
 */
function extractWhiteboardText(ydoc) {
  if (!ydoc) return "";

  const names = ["strokes", "whiteboard", "canvas"];
  for (const name of names) {
    try {
      const arr = ydoc.getArray(name);
      if (arr && arr.length > 0) {
        // Collect any text-type strokes (text tool annotations)
        const textAnnotations = [];
        for (const stroke of arr.toArray()) {
          if (stroke?.type === "text" && stroke?.text) {
            textAnnotations.push(stroke.text);
          }
          // Some whiteboard libs store label/note fields
          if (stroke?.label) textAnnotations.push(stroke.label);
          if (stroke?.note)  textAnnotations.push(stroke.note);
        }
        const count = arr.length;
        const textPart = textAnnotations.length > 0
          ? `\nText annotations on whiteboard:\n${textAnnotations.join("\n")}`
          : "";
        return `Whiteboard contains ${count} drawn element${count !== 1 ? "s" : ""}.${textPart}`;
      }
    } catch {}
  }

  return "";
}

// ─── markdown-ish renderer (no external dep) ────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bold headers like **📋 Overview**
    if (/^\*\*.*\*\*$/.test(line.trim())) {
      const content = line.trim().replace(/^\*\*|\*\*$/g, "");
      elements.push(
        <div key={key++} style={{
          fontSize: "13px", fontWeight: "700", color: "#e2e8f0",
          marginTop: i === 0 ? 0 : "18px", marginBottom: "6px",
          letterSpacing: "0.01em",
        }}>
          {content}
        </div>
      );
      continue;
    }

    // Bullet points
    if (/^[-•*] /.test(line.trim())) {
      const content = line.trim().replace(/^[-•*] /, "");
      elements.push(
        <div key={key++} style={{ display: "flex", gap: "8px", marginBottom: "4px", alignItems: "flex-start" }}>
          <span style={{ color: "#6366f1", fontSize: "14px", lineHeight: "20px", flexShrink: 0 }}>▸</span>
          <span style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "20px" }}>
            {renderInline(content)}
          </span>
        </div>
      );
      continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: "6px" }} />);
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "20px", margin: "0 0 4px" }}>
        {renderInline(line)}
      </p>
    );
  }

  return elements;
}

function renderInline(text) {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} style={{ color: "#cbd5e1", fontWeight: "600" }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── component ──────────────────────────────────────────────────────────────

export default function AISummaryPanel({ ydocRef, isOpen, onClose, roomId }) {
  const [summary, setSummary]     = useState("");
  const [status, setStatus]       = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg]   = useState("");
  const [copied, setCopied]       = useState(false);
  const [sourceInfo, setSourceInfo] = useState({ hasDoc: false, hasWb: false });
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll as tokens stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [summary]);

  const runSummary = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setSummary("");
    setStatus("loading");
    setErrorMsg("");

    const ydoc = ydocRef?.current;
    const docsText       = extractDocsText(ydoc);
    const whiteboardText = extractWhiteboardText(ydoc);

    setSourceInfo({
      hasDoc: docsText.length > 0,
      hasWb:  whiteboardText.length > 0,
    });

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docsText, whiteboardText }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { setStatus("done"); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) setSummary(prev => prev + parsed.text);
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setStatus("done");
    } catch (err) {
      if (err.name === "AbortError") return;
      setErrorMsg(err.message ?? "Something went wrong");
      setStatus("error");
    }
  }, [ydocRef]);

  // Auto-run when panel opens
  useEffect(() => {
    if (isOpen && status === "idle") {
      runSummary();
    }
    if (!isOpen) {
      abortRef.current?.abort();
      setStatus("idle");
      setSummary("");
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
            }}
          />

          {/* Slide-in panel */}
          <motion.aside
            key="ai-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(420px, 92vw)", zIndex: 80,
              display: "flex", flexDirection: "column",
              background: "rgba(9,11,18,0.97)",
              backdropFilter: "blur(32px)",
              borderLeft: "1px solid rgba(99,102,241,0.2)",
              boxShadow: "-24px 0 80px rgba(0,0,0,0.6)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "20px 20px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "9px",
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 20px rgba(99,102,241,0.4)",
                    flexShrink: 0,
                  }}>
                    <Sparkles size={15} color="white" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>
                      AI Summary
                    </h2>
                    <p style={{ margin: 0, fontSize: "11px", color: "#475569", fontFamily: "monospace" }}>
                      {roomId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: "28px", height: "28px", borderRadius: "7px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#64748b",
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Source badges */}
              <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                <SourceBadge
                  icon={<FileText size={11} />}
                  label="Document"
                  active={sourceInfo.hasDoc}
                />
                <SourceBadge
                  icon={<Layout size={11} />}
                  label="Whiteboard"
                  active={sourceInfo.hasWb}
                />
              </div>
            </div>

            {/* Body — scrollable summary */}
            <div
              ref={scrollRef}
              style={{
                flex: 1, overflowY: "auto", padding: "20px",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(99,102,241,0.2) transparent",
              }}
            >
              {status === "loading" && summary === "" && (
                <LoadingState />
              )}

              {status === "error" && (
                <div style={{
                  padding: "16px", borderRadius: "12px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#f87171" }}>
                    {errorMsg || "Something went wrong. Try again."}
                  </p>
                </div>
              )}

              {summary && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ lineHeight: "1.6" }}
                >
                  {renderMarkdown(summary)}
                  {status === "loading" && (
                    <span style={{
                      display: "inline-block", width: "2px", height: "14px",
                      background: "#6366f1", marginLeft: "2px",
                      animation: "blink 1s step-end infinite",
                      verticalAlign: "text-bottom",
                    }} />
                  )}
                </motion.div>
              )}

              {status === "done" && !summary && (
                <p style={{ fontSize: "13px", color: "#475569", textAlign: "center", marginTop: "40px" }}>
                  Nothing to summarize yet — add content to the doc or whiteboard first.
                </p>
              )}
            </div>

            {/* Footer actions */}
            <div style={{
              padding: "14px 20px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", gap: "8px", flexShrink: 0,
            }}>
              <button
                onClick={runSummary}
                disabled={status === "loading"}
                style={{
                  flex: 1, padding: "10px 16px", borderRadius: "10px",
                  border: "1px solid rgba(99,102,241,0.3)",
                  background: status === "loading" ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.12)",
                  color: status === "loading" ? "#475569" : "#818cf8",
                  fontSize: "12px", fontWeight: "700", cursor: status === "loading" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  transition: "all 0.15s",
                }}
              >
                <RefreshCw size={13} style={{
                  animation: status === "loading" ? "spin 1s linear infinite" : "none",
                }} />
                {status === "loading" ? "Summarizing…" : "Regenerate"}
              </button>

              {summary && status === "done" && (
                <button
                  onClick={handleCopy}
                  style={{
                    padding: "10px 16px", borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: copied ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                    color: copied ? "#10b981" : "#64748b",
                    fontSize: "12px", fontWeight: "700", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
          </motion.aside>

          <style>{`
            @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
            @keyframes spin  { to{transform:rotate(360deg)} }
            @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SourceBadge({ icon, label, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "6px",
      background: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
      color: active ? "#818cf8" : "#334155",
      fontSize: "11px", fontWeight: "600",
      transition: "all 0.2s",
    }}>
      {icon}
      {label}
      {active && (
        <div style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: "#6366f1",
          boxShadow: "0 0 6px rgba(99,102,241,0.8)",
        }} />
      )}
    </div>
  );
}

function LoadingState() {
  const lines = [
    { w: "70%", delay: "0s" },
    { w: "55%", delay: "0.1s" },
    { w: "80%", delay: "0.2s" },
    { w: "40%", delay: "0.3s" },
    { w: "65%", delay: "0.15s" },
    { w: "50%", delay: "0.25s" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#6366f1", animation: "pulse 1.5s ease-in-out infinite",
        }} />
        <span style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>
          Analyzing session content…
        </span>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{
          height: "10px", borderRadius: "5px",
          background: "rgba(99,102,241,0.08)",
          width: l.w,
          animation: `pulse 1.8s ${l.delay} ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}