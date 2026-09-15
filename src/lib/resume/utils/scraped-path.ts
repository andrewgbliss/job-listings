/** Default on-disk folder for captured listings, relative to the repo root. */
export const defaultScrapedFolderPath = "src/lib/resume/scraped";

export const scrapedFolderHref = "/resume/scraped" as const;

const DATE_FOLDER = /^(\d{4})_(\d{2})_(\d{2})$/;

export function isScrapedDateFolder(name: string) {
  return DATE_FOLDER.test(name);
}

/** Local calendar date as `YYYY_MM_DD` for scraped folder names. */
export function processedDateFolder(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Instant the listing was captured or last processed (local ISO with offset). */
export function processedAtIso(date = new Date()) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hours = pad2(Math.floor(abs / 60));
  const minutes = pad2(abs % 60);
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${ms}${sign}${hours}:${minutes}`;
}

const processedAtFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatProcessedAt(value?: string) {
  if (!value) {
    return "—";
  }
  const folder = value.match(DATE_FOLDER);
  if (folder) {
    return `${folder[1]}-${folder[2]}-${folder[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return processedAtFormatter.format(date);
}
