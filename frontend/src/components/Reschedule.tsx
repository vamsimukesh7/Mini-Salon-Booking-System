import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  api,
  timeLabel,
  errorText,
  type Service,
  type Booking,
  type Config,
} from "../api";
import ErrorBox from "./ErrorBox";
export default function Reschedule({
  booking,
  config,
  onClose,
  onSaved,
}: {
  booking: Booking;
  services: Service[];
  config: Config;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(
      booking.date < config.today ? config.today : booking.date,
    ),
    [time, setTime] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSlots([]);
    setTime("");
    api<{ slots: string[] }>(
      `/availability?date=${date}&service_id=${booking.service_id}&exclude_id=${booking.id}`,
    )
      .then((d) => {
        if (active) {
          setSlots(d.slots);
          setError("");
        }
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
  }, [date, booking]);
  return (
    <dialog ref={dialog} className="modal" onCancel={onClose}>
      <div className="card-heading">
        <h2>Find a new moment</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close rescheduling"
        >
          <X />
        </button>
      </div>
      <p>
        {booking.customer_name} · {booking.service_name}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/bookings/" + booking.id, {
              method: "PATCH",
              body: JSON.stringify({ date, time }),
            });
            onSaved();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          New date
          <input
            type="date"
            min={config.today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          New time
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            disabled={loading}
          >
            <option value="">
              {loading ? "Loading slots…" : "Choose an available time"}
            </option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {timeLabel(s)}
              </option>
            ))}
          </select>
        </label>
        {!loading && !slots.length && (
          <p>No slots available. Choose another date.</p>
        )}
        <ErrorBox message={error} />
        <button className="primary" disabled={busy || loading}>
          {busy ? "Moving appointment…" : "Save new appointment"}
        </button>
      </form>
    </dialog>
  );
}
