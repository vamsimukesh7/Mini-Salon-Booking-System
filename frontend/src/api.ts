export const base = import.meta.env.VITE_API_URL || "";
export type Service = {
  id: number;
  name: string;
  price_paise: number;
  duration: number;
};
export type Booking = {
  id: string;
  customer_name: string;
  phone: string;
  service_id: number;
  service_name: string;
  date: string;
  time: string;
  end_time: string;
  price_paise: number;
  status: string;
  duration: number;
  previous_slot?: string;
};
export type Invoice = {
  id: string;
  booking_id: string;
  customer_name: string;
  issued_at: string;
  total_paise: number;
  items?: { name: string; quantity: number; unit_price_paise: number }[];
};
export type Config = {
  today: string;
  open: string;
  close: string;
  timezone: string;
  policy: string;
};
export const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
export const dayLabel = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
export const timeLabel = (v: string) =>
  new Date("2000-01-01T" + v).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("atelier-token");
  const response = await fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
    signal: options.signal || AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem("atelier-token");
      window.dispatchEvent(new Event("atelier-auth-expired"));
    }
    const data = await response
      .json()
      .catch(() => ({ detail: "Connection failed. Please retry." }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check all required fields and try again.",
    );
  }
  return response.json();
}
export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please retry.";
