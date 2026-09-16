# Create a resume from a captured job listing

POST the current page's URL and HTML to a local-only capture server. It writes the HTML under `src/lib/job-listings/scraped/YYYY_MM_DD/<domain>/`, scrapes it for one job listing, and generates a tailored resume from `main_resume.ts` plus a cover letter from `src/lib/cover-letter/main_cover_letter.md`.

The generator does not invent jobs. It keeps the full work history and bullet order from `main_resume.ts`. Tailoring matches listing skills, sets the tagline from the job title, swaps that title into the start of the summary, and when a bullet mentions Next.js but the listing does not, replaces Next.js with the listing's highest-weighted skill. It does not reorder work-experience skills.

The cover letter fills `{{POSITION}}` from the listing title, names the company when known, and remaps the JavaScript/React skill pair to listing-matched skills from the resume.

Do not store the hiring company's name in resume ids, filenames, tags, or generated resume modules. Ids come from the job URL (`job-4466103929`). Listing JSON keeps url, searchUrl, title, company, skills, and processedAt (ISO datetime) — no description body. Company is for tables only and is not shown on the resume. Cover letters may name the company.

## Capture (local `next dev` only)

`npm run dev` starts the static Next app on port 3000 and a localhost-only capture API on port 3001. The API is never part of `next build` or GitHub Pages.

The capture API responds immediately with HTTP 202 `{ ok: true, loading: true, message: "loading", url, id }` and finishes writing HTML, listing JSON, the resume, and PDF in the background.

```bash
curl -X POST http://127.0.0.1:3001/api/capture-html \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.linkedin.com/jobs/view/4466103929\",\"html\":\"<html>...</html>\"}"
```

JSON body:

- `url` (required) — page URL
- `html` (required) — page HTML
- `searchUrl` (optional) — search results URL if `url` is a single posting

Bookmarklet (run on the job page while logged in):

```js
javascript:void fetch('http://127.0.0.1:3001/api/capture-html',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,html:document.documentElement.outerHTML})}).then(r=>r.json()).then(d=>alert(d.message||d.error)).catch(e=>alert(e))
```

Each capture writes the page HTML under `src/lib/job-listings/scraped/YYYY_MM_DD/<domain>/job_<id>.html`, even when there is no scrape strategy for that domain or the HTML does not look like a job. Successful scrapes also write:

1. `job_<id>_listing.json`
2. `job_<id>_resume.ts` — picked up automatically from the scraped folder
3. `job_<id>_cover_letter.md` — tailored from `main_cover_letter.md`
