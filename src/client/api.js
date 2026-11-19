export async function api(path, { method = "GET", body, token = localStorage.getItem("origenes-token") } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `La solicitud falló (${response.status}).`);
  }
  return payload;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-SV", { dateStyle: "medium" }).format(new Date(value));
}
