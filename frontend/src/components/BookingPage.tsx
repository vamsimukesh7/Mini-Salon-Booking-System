import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock3,
  Sparkles,
  Scissors,
  Leaf,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
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
const serviceIcons = [Scissors, Scissors, Leaf, Sparkles, Sparkles];
export default function BookingPage({
  services,
  config,
}: {
  services: Service[];
  config: Config;
}) {
  const [service, setService] = useState(services[0]?.id || 0),
    [date, setDate] = useState(config.today),
    [time, setTime] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [slotsLoading, setSlotsLoading] = useState(false),
    [slotError, setSlotError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState<Booking | null>(null),
    [tried, setTried] = useState(false),
    [refresh, setRefresh] = useState(0);
  const submission = useRef(false),
    key = useRef(crypto.randomUUID());
  const selected = services.find((s) => s.id === service);
  useEffect(() => {
    let active = true;
    setTime("");
    setSlots([]);
    setSlotError("");
    setSlotsLoading(true);
    api<{ slots: string[] }>(`/availability?date=${date}&service_id=${service}`)
      .then((d) => {
        if (active) setSlots(d.slots);
      })
      .catch((e) => {
        if (active) setSlotError(errorText(e));
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, service, refresh]);
  useEffect(() => {
    key.current = crypto.randomUUID();
  }, [service, date, time, name, phone]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (
      submission.current ||
      name.trim().length < 2 ||
      !/^\d{10}$/.test(phone) ||
      !time
    )
      return;
    submission.current = true;
    setBusy(true);
    try {
      const result = await api<Booking>("/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          customer_name: name,
          phone,
          service_id: service,
          date,
          time,
        }),
      });
      setDone(result);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
      setRefresh((v) => v + 1);
    } finally {
      setBusy(false);
      submission.current = false;
    }
  };
  return (
    <>
      <div className="page-eyebrow">
        <span /> YOUR NEIGHBOURHOOD SALON, REIMAGINED
      </div>
      <section className="booking-layout">
        <div className="intro">
          <div className="intro-copy">
            <h1>
              Look good.
              <br />
              Feel <em>like you.</em>
            </h1>
            <p>
              A fresh cut, a little care, a well-deserved pause.
              <br className="desktop" /> Your next good-hair day starts here.
            </p>
            <div className="intro-meta">
              <span>
                <Clock3 size={16} /> Daily {timeLabel(config.open)} –{" "}
                {timeLabel(config.close)}
              </span>
              <span>
                <ShieldCheck size={16} /> Thoughtful care, every visit
              </span>
            </div>
          </div>
          <div
            className="salon-art"
            aria-label="Illustration of a calm salon mirror and botanical arrangement"
            role="img"
          >
            <div className="art-grain" />
            <div className="arch">
              <div className="mirror-shine" />
              <div className="mirror-line" />
            </div>
            <div className="shelf" />
            <div className="vase" />
            <div className="plant stem1" />
            <div className="plant stem2" />
            <div className="plant stem3" />
            <div className="bottle bottle1" />
            <div className="bottle bottle2" />
            <div className="art-caption">
              <span>THE EVERYDAY RITUAL</span>
              <p>
                A space to slow down.
                <br />A style to make your own.
              </p>
            </div>
            <div className="art-stamp">
              <Sparkles size={19} />
              <span>
                A little care.
                <br />A lot of confidence.
              </span>
            </div>
          </div>
          <div className="trust-line">
            <span>
              01 <b>Choose your ritual</b>
            </span>
            <ChevronRight size={14} />
            <span>
              02 <b>Find your moment</b>
            </span>
            <ChevronRight size={14} />
            <span>
              03 <b>Leave feeling fresh</b>
            </span>
          </div>
        </div>
        <div className="booking-card" id="booking">
          {done ? (
            <div className="confirmation" role="status">
              <div className="success-icon">
                <CheckCircle2 size={35} />
              </div>
              <span className="eyebrow">YOU’RE ON THE LIST</span>
              <h2>Your moment is reserved.</h2>
              <p>
                Thanks, {done.customer_name}. Your appointment request has been
                saved. The salon will confirm it shortly.
              </p>
              <div className="confirmation-details">
                <strong>{done.service_name}</strong>
                <span>
                  {dayLabel(done.date)} · {timeLabel(done.time)}
                </span>
                <span>
                  {money(done.price_paise)} · {done.duration} minutes
                </span>
                <span>{done.phone}</span>
                <span className="badge Pending">{done.status}</span>
                <small>Booking reference: {done.id}</small>
              </div>
              <p className="muted">
                Need to change plans? Contact the salon owner with your booking
                reference.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setDone(null);
                  setTime("");
                  setTried(false);
                  setName("");
                  setPhone("");
                }}
              >
                Book another visit <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="card-heading">
                <div>
                  <span className="eyebrow">MAKE TIME FOR YOU</span>
                  <h2>Book your visit</h2>
                </div>
                <span className="circle-icon">
                  <CalendarDays size={23} />
                </span>
              </div>
              <p className="card-subtitle">
                A few details, and we’ll save you a seat.
              </p>
              <form onSubmit={submit} noValidate>
                <div className="section-label">
                  <span>01</span> Your details
                </div>
                <div className="form-row">
                  <label>
                    Your name
                    <input
                      aria-label="Your name"
                      autoComplete="name"
                      placeholder="e.g. Ananya Sharma"
                      value={name}
                      maxLength={100}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={tried && name.trim().length < 2}
                    />
                    {tried && name.trim().length < 2 && (
                      <small className="field-error">
                        Enter at least 2 characters.
                      </small>
                    )}
                  </label>
                  <label>
                    Phone number
                    <div className="phone-field">
                      <span>+91</span>
                      <input
                        aria-label="Phone number"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="10-digit mobile"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        aria-invalid={tried && !/^\d{10}$/.test(phone)}
                      />
                    </div>
                    {tried && !/^\d{10}$/.test(phone) && (
                      <small className="field-error">
                        Enter a 10-digit phone number.
                      </small>
                    )}
                  </label>
                </div>
                <div className="section-label">
                  <span>02</span> Your ritual
                </div>
                <label>
                  Choose a service
                  <select
                    value={service}
                    onChange={(e) => setService(Number(e.target.value))}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {money(s.price_paise)}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <div className="service-summary">
                    <span>
                      <Sparkles size={17} />
                      {selected.name}
                      <small>
                        <Clock3 size={13} />
                        {selected.duration} min
                      </small>
                    </span>
                    <strong>{money(selected.price_paise)}</strong>
                  </div>
                )}
                <div className="section-label">
                  <span>03</span> Your moment
                </div>
                <label>
                  Preferred date
                  <input
                    type="date"
                    min={config.today}
                    value={date}
                    required
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <div className="slot-heading">
                  <span>Available times</span>
                  <small>{config.timezone}</small>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Refresh available times"
                    onClick={() => setRefresh((v) => v + 1)}
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div
                  className="slots"
                  role="group"
                  aria-label="Available time slots"
                >
                  {slotsLoading ? (
                    <p className="muted">Finding your moment…</p>
                  ) : slotError ? (
                    <ErrorBox message={slotError} />
                  ) : slots.length ? (
                    slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={time === s}
                        className={time === s ? "slot selected" : "slot"}
                        onClick={() => setTime(s)}
                      >
                        {timeLabel(s)}
                        {time === s && <Check size={12} />}
                      </button>
                    ))
                  ) : (
                    <p className="empty-slots">
                      No appointments left on this date. Try another day.
                    </p>
                  )}
                </div>
                {tried && !time && (
                  <small className="field-error">
                    Choose an available time.
                  </small>
                )}
                <ErrorBox message={error} />
                <div className="booking-total">
                  <span>
                    Your visit{" "}
                    <small>{selected?.duration} minutes of you-time</small>
                  </span>
                  <strong>{money(selected?.price_paise || 0)}</strong>
                </div>
                <button
                  className="primary"
                  disabled={busy || slotsLoading}
                  type="submit"
                >
                  {busy ? "Reserving your moment…" : "Book my appointment"}
                  <ArrowRight size={18} />
                </button>
                <p className="form-footnote">
                  <ShieldCheck size={13} /> No payment needed now. Pay at the
                  salon.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
      <section className="services-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">A LITTLE SOMETHING FOR EVERY YOU</span>
            <h2>Care, from head to glow.</h2>
          </div>
          <span className="muted">Honest prices. Exceptional attention.</span>
        </div>
        <div className="service-grid">
          {services.map((s, i) => {
            const Icon = serviceIcons[i] || Sparkles;
            return (
              <button
                className={
                  service === s.id ? "service-tile chosen" : "service-tile"
                }
                key={s.id}
                onClick={() => {
                  setService(s.id);
                  document
                    .getElementById("booking")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <Icon size={24} strokeWidth={1.3} />
                <h3>{s.name}</h3>
                <span>
                  {s.duration} min <b>{money(s.price_paise)}</b>
                </span>
                <ArrowUpRight className="tile-arrow" size={16} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
