# Create a resume from a captured job listing

POST the current page's URL and HTML to a local-only capture server. It writes the HTML under `src/lib/resume/scraped/<domain>/`, scrapes it for one job listing, and generates a tailored resume from `main_resume.ts`.

The generator does not invent jobs. It scores real work history against the listing, keeps the closest matches, then rewrites the summary and bullets using the listing's own skill names and phrasing while leaving facts and metrics unchanged.

Do not store the hiring company's name anywhere: not in resume ids, filenames, tags, listing JSON, or generated modules. Ids come from the job URL (`job-4466103929`). Listing JSON keeps url, searchUrl, title, and skills only — no employer field and no description body.

## Capture (local `next dev` only)

`npm run dev` starts the static Next app on port 3000 and a localhost-only capture API on port 3001. The API is never part of `next build` or GitHub Pages.

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
javascript:void fetch('http://127.0.0.1:3001/api/capture-html',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,html:document.documentElement.outerHTML})}).then(r=>r.json()).then(d=>alert(d.resumeHref||d.error)).catch(e=>alert(e))
```

Each capture writes:

1. `src/lib/resume/scraped/<domain>/job_<id>.html`
2. `job_<id>_listing.json`
3. `job_<id>_resume.ts`
4. Refresh of `src/lib/resume/scraped/index.ts` so `/resume/<id>` picks it up
