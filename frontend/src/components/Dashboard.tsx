import React, { useState, useEffect } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import {
  api,
  money,
  dayLabel,
  timeLabel,
  errorText,
  type Service,
  type Booking,
  type Config,
} from "../api";
import ErrorBox from "./ErrorBox";
import Reschedule from "./Reschedule";
export default function Dashboard({
  services,
  config,
}: {
  services: Service[];
  config: Config;
}) {
  const [date, setDate] = useState(config.today),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [editing, setEditing] = useState<Booking | null>(null),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Booking[]>(
      "/bookings?" +
        new URLSearchParams({
          ...(date ? { date } : {}),
          ...(status ? { status } : {}),
          search,
        }),
    )
      .then((d) => {
        if (active) setBookings(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, status, search, refresh]);
  const update = async (b: Booking, s: string) => {
    setBusy(b.id);
    setError("");
    try {
      await api("/bookings/" + b.id, {
        method: "PATCH",
        body: JSON.stringify({ status: s }),
      });
      setNotice(`${b.customer_name} · marked ${s.toLowerCase()}`);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };
  const counts = ["Pending", "Confirmed", "Done", "Cancelled"].map(
    (s) => bookings.filter((b) => b.status === s).length,
  );
  return (
    <section className="workspace">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">MAKE EVERY VISIT COUNT</span>
          <h1>Your salon, at a glance.</h1>
          <p>A little organisation. A smoother day.</p>
        </div>
        <button className="secondary" onClick={() => setRefresh((v) => v + 1)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <div className="stats">
        {["Pending", "Confirmed", "Done", "Cancelled"].map((s, i) => (
          <div className="stat" key={s}>
            <span>{s}</span>
            <strong>{counts[i].toString().padStart(2, "0")}</strong>
            <small>in current view</small>
          </div>
        ))}
      </div>
      <div className="filters">
        <label>
          Date
          <input
            aria-label="Filter date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["Pending", "Confirmed", "Done", "Cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="search">
          Search appointments
          <input
            placeholder="Name, phone or booking reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="text-btn"
          onClick={() => {
            setDate(config.today);
            setStatus("");
            setSearch("");
          }}
        >
          Today
        </button>
        <button className="text-btn" onClick={() => setDate("")}>
          All dates
        </button>
      </div>
      <ErrorBox message={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="day-view">
        <div className="day-title">
          <CalendarDays size={20} />
          <h2>{date ? dayLabel(date) : "All appointments"}</h2>
          <span>{bookings.length} appointments</span>
        </div>
        {loading ? (
          <p className="loading">Loading appointments…</p>
        ) : bookings.length === 0 ? (
          <div className="empty">
            <CalendarDays />
            <h3>A little breathing room.</h3>
            <p>No appointments match these filters.</p>
          </div>
        ) : (
          bookings.map((b, i) => (
            <React.Fragment key={b.id}>
              {!date && (i === 0 || bookings[i - 1].date !== b.date) && (
                <h3 className="day-group">{dayLabel(b.date)}</h3>
              )}
              <article className="appointment">
                <div className="appointment-time">
                  <strong>{timeLabel(b.time)}</strong>
                  <span>{timeLabel(b.end_time)}</span>
                </div>
                <div className="avatar">
                  {b.customer_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="appointment-person">
                  <h3>{b.customer_name}</h3>
                  <a href={"tel:+91" + b.phone}>{b.phone}</a>
                  <small>{b.id}</small>
                </div>
                <div className="appointment-service">
                  <strong>{b.service_name}</strong>
                  <span>
                    {money(b.price_paise)} · {b.duration} min
                  </span>
                  {b.previous_slot && (
                    <small>Moved from {b.previous_slot}</small>
                  )}
                </div>
                <span className={"badge " + b.status}>{b.status}</span>
                <div className="appointment-actions">
                  {b.status === "Pending" && (
                    <button
                      className="secondary small"
                      disabled={busy === b.id}
                      onClick={() => update(b, "Confirmed")}
                    >
                      Confirm
                    </button>
                  )}
                  {b.status === "Confirmed" && (
                    <button
                      className="secondary small"
                      disabled={busy === b.id}
                      onClick={() => update(b, "Done")}
                    >
                      Mark done
                    </button>
                  )}
                  {["Pending", "Confirmed"].includes(b.status) && (
                    <>
                      <button
                        className="text-btn"
                        onClick={() => setEditing(b)}
                      >
                        Reschedule
                      </button>
                      <button
                        className="text-btn danger"
                        disabled={busy === b.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Cancel ${b.customer_name}'s appointment?`,
                            )
                          )
                            void update(b, "Cancelled");
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </article>
            </React.Fragment>
          ))
        )}
      </div>
      {editing && (
        <Reschedule
          booking={editing}
          services={services}
          config={config}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice(
              "Appointment rescheduled. Availability has been updated.",
            );
            setRefresh((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
