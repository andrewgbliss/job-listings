/** Listing titles to prefer on resumes, cover letters, and PDF filenames. */
const JOB_TITLE_REWRITES: Array<[RegExp, string]> = [
  [/^senior engineer,\s*full[-\s]?stack$/i, "Senior Full-Stack Engineer"],
  [
    /^senior software engineer\s*\(\s*full[-\s]?stack\s*\)$/i,
    "Senior Full-Stack Software Engineer",
  ],
  [
    /^sr\.?\s+full[-\s]?stack(?: software)? engineer$/i,
    "Senior Full-Stack Software Engineer",
  ],
];

const ROLE_SEGMENT =
  /^(?:Senior |Staff |Principal |Lead |Junior |Jr\.? |Sr\.? |Technical )?(?:Full[ -]?Stack |Frontend |Front[ -]End |Backend |Back[ -]End |Web |Mobile |Platform |Cloud |Data |Digital |Application |UX )?(?:Software )?(?:Engineer|Developer|Architect|Consultant|Manager|Designer|Analyst|Specialist)(?:\s+(?:IV|V|I{1,3}|[2-5]))?$/i;

function isRoleSegment(part: string) {
  const trimmed = part.trim();
  return (
    ROLE_SEGMENT.test(trimmed) &&
    trimmed.length >= 8 &&
    trimmed.length <= 80
  );
}

/** Keep the role; drop " - Next-Gen" / company suffixes and trailing dashes. */
export function compactDashedRoleTitle(title: string) {
  const stripped = title.replace(/\s*[-–—]+\s*$/g, "").trim() || title;
  const parts = stripped
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return stripped;
  }
  const roles = parts.filter(isRoleSegment);
  return roles.at(-1) ?? stripped;
}

function applyRewrites(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) {
    return undefined;
  }
  for (const [pattern, replacement] of JOB_TITLE_REWRITES) {
    if (pattern.test(trimmed)) {
      return replacement;
    }
  }
  return undefined;
}

function withoutParentheticals(title: string) {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROLE_PREFIX =
  /^(?:Senior|Staff|Principal|Lead|Junior|Jr\.?|Sr\.?|Technical|Full[ -]?Stack|Frontend|Front[ -]End|Backend|Back[ -]End|Web|Mobile|Platform|Cloud|Data|Digital|Application|UX|Software)$/i;

function recoverRoleFromSource(title: string, sourceText: string) {
  const pattern = new RegExp(
    ROLE_SEGMENT.source.replace(/^\^/, "").replace(/\$$/, ""),
    "gi",
  );
  const titleLower = title.toLowerCase();
  let exact = false;
  const longer = new Map<string, string>();
  for (const match of sourceText.matchAll(pattern)) {
    const candidate = compactDashedRoleTitle(match[0]);
    if (!isRoleSegment(candidate) || candidate.length > 80) {
      continue;
    }
    const lower = candidate.toLowerCase();
    if (lower === titleLower) {
      exact = true;
      continue;
    }
    if (!lower.endsWith(titleLower)) {
      continue;
    }
    const prefix = candidate
      .slice(0, Math.max(0, candidate.length - title.length))
      .trim();
    if (!prefix || !ROLE_PREFIX.test(prefix)) {
      continue;
    }
    longer.set(lower, candidate);
  }
  // A search page lists many roles. Keep this posting's title when it already
  // appears on its own; only fill in a missing prefix when the page has one.
  if (exact || longer.size !== 1) {
    return undefined;
  }
  return longer.values().next().value;
}

export function rewriteJobTitle(
  title: string | undefined,
  sourceText?: string,
): string | undefined {
  const trimmed = title?.trim();
  if (trimmed) {
    const compacted = compactDashedRoleTitle(trimmed);
    const recovered =
      sourceText ? recoverRoleFromSource(compacted, sourceText) : undefined;
    const rewritten =
      applyRewrites(recovered ?? compacted) ?? applyRewrites(trimmed);
    if (rewritten) {
      return rewritten;
    }
    if (recovered) {
      return recovered;
    }
    if (compacted !== trimmed) {
      return compacted;
    }
  }
  if (trimmed && sourceText) {
    for (const [pattern, replacement] of JOB_TITLE_REWRITES) {
      const searchable = new RegExp(
        pattern.source.replace(/^\^/, "").replace(/\$$/, ""),
        pattern.flags,
      );
      const match = sourceText.match(searchable);
      if (!match) {
        continue;
      }
      if (withoutParentheticals(match[0]).toLowerCase() === trimmed.toLowerCase()) {
        return replacement;
      }
    }
  }
  return trimmed || title;
}
