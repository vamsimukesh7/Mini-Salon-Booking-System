import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Sparkles, MessageCircle, X, Send } from "lucide-react";
import { api, errorText } from "../api";
import ErrorBox from "./ErrorBox";
export default function Chat() {
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<
      { role: string; text: string; notice?: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [last, setLast] = useState("");
  const bottom = useRef<HTMLDivElement>(null),
    sending = useRef(false);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  const send = async (message: string, retry = false) => {
    if (!message.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setLast(message);
    setInput("");
    if (!retry) setMessages((m) => [...m, { role: "user", text: message }]);
    try {
      const result = await api<{ answer: string; notice: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, notice: result.notice },
      ]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      sending.current = false;
    }
  };
  return (
    <div className="chat-container">
      {open && (
        <section className="chat-panel" aria-label="Salon assistant">
          <div className="chat-header">
            <div className="chat-avatar">
              <Sparkles size={21} />
            </div>
            <div>
              <strong>Your salon companion</strong>
              <small>Services, prices & a little guidance</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="chat-messages" aria-live="polite">
            <div className="chat-bubble assistant">
              Hi, you! Ask me about our services, prices or available
              appointments. English, Hinglish, Marathi — all welcome.
              <small>Availability is live. Book through the form.</small>
            </div>
            {!messages.length && (
              <div className="chat-suggestions">
                {[
                  "Haircut ka price kitna hai?",
                  "What are your opening hours?",
                  "Mala facial chi price sanga.",
                ].map((q) => (
                  <button key={q} onClick={() => void send(q)}>
                    {q}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div className={"chat-bubble " + m.role} key={i}>
                {m.text}
                {m.notice && <small>{m.notice}</small>}
              </div>
            ))}
            {busy && (
              <p className="muted" role="status">
                Checking the salon details…
              </p>
            )}
            {error && (
              <>
                <ErrorBox message={error} />
                <button
                  className="text-btn"
                  onClick={() => void send(last, true)}
                >
                  Retry message
                </button>
              </>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              aria-label="Message salon assistant"
              placeholder="Ask a little something…"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
            />
            <button aria-label="Send message" disabled={busy || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
          <small className="chat-disclaimer">
            No personal details needed. AI mode is labelled.
          </small>
        </section>
      )}
      <button
        className="chat-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Hide salon assistant" : "Open salon assistant"}
      >
        {open ? (
          <X size={20} />
        ) : (
          <>
            <MessageCircle size={19} />
            <span>Ask Atelier</span>
            <span className="chat-online" />
          </>
        )}
      </button>
    </div>
  );
}
