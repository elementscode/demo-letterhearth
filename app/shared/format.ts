const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatDate(date: Date): string {
  return DATE.format(date);
}

export function formatShortDate(date: Date): string {
  return SHORT.format(date);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** The text to show for an error from an rpc, including per-field errors. */
export function errorMessage(err: any): string {
  let fields = err?.errors;

  if (fields && typeof fields === "object") {
    let messages = Object.values(fields).flat().filter(Boolean) as string[];

    if (messages.length > 0) {
      return messages.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(". ") + ".";
    }
  }

  let text = String(err?.message ?? "Something went wrong.");

  return text.charAt(0).toUpperCase() + text.slice(1);
}
