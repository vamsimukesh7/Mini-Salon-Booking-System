import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-600.css";
import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  LogOut,
  Menu,
} from "lucide-react";
import { api, errorText, type Service, type Config } from "./api";
import ErrorBox from "./components/ErrorBox";
import BookingPage from "./components/BookingPage";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Billing from "./components/Billing";
import Chat from "./components/Chat";
import { createRoot } from "react-dom/client";
import "./style.css";
type Page = "book" | "admin" | "billing";
function App() {
  const [page, setPage] = useState<Page>(() =>
      location.hash === "#admin"
        ? "admin"
        : location.hash === "#billing"
          ? "billing"
          : "book",
    ),
    [services, setServices] = useState<Service[]>([]),
    [config, setConfig] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [token, setToken] = useState(sessionStorage.getItem("atelier-token") || ""),
    [menu, setMenu] = useState(false);
  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api<Service[]>("/services"), api<Config>("/config")])
      .then(([s, c]) => {
        setServices(s);
        setConfig(c);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    history.replaceState(null, "", `#${page}`);
  }, [page]);
  useEffect(load, []);
  useEffect(() => {
    const handler = () => setToken("");
    window.addEventListener("atelier-auth-expired", handler);
    return () => window.removeEventListener("atelier-auth-expired", handler);
  }, []);
  return (
    <>
      <header>
        <a className="brand" href="#" onClick={() => setPage("book")}>
          atelier<span>.</span>
          <small>SALON & SELF CARE</small>
        </a>
        <button
          className="mobile-menu icon-btn"
          aria-label="Toggle navigation"
          onClick={() => setMenu(!menu)}
        >
          <Menu />
        </button>
        <nav className={menu ? "expanded" : ""}>
          {(
            [
              ["book", "Book a visit", CalendarDays],
              ["admin", "Owner dashboard", LayoutDashboard],
              ["billing", "Billing", ReceiptText],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "nav active" : "nav"}
              onClick={() => {
                setPage(key);
                setMenu(false);
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="header-note">
          <span className="dot" /> A little time for yourself
        </div>
      </header>
      <main>
        {loading ? (
          <div className="loading">Preparing your salon experience…</div>
        ) : error ? (
          <div className="load-error">
            <ErrorBox message={error} />
            <button onClick={load}>Retry connection</button>
          </div>
        ) : (
          config && (
            <>
              {page === "book" ? (
                <BookingPage services={services} config={config} />
              ) : !token ? (
                <Login onLogin={setToken} />
              ) : (
                <>
                  <div className="owner-toolbar">
                    <span>
                      <ShieldCheck size={15} /> Owner workspace
                    </span>
                    <button
                      className="text-btn"
                      onClick={() => {
                        sessionStorage.removeItem("atelier-token");
                        setToken("");
                      }}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                  {page === "admin" ? (
                    <Dashboard services={services} config={config} />
                  ) : (
                    <Billing services={services} />
                  )}
                </>
              )}
            </>
          )
        )}
      </main>
      <footer>
        <span className="footer-brand">atelier.</span>
        <span>Good hair. A fresh start. A moment for you.</span>
        <span>Made for your everyday glow.</span>
      </footer>
      {page === "book" && <Chat />}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
