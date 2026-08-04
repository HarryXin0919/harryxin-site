# harryxin.com

Static personal site with a Vercel Function-backed RLCard telemetry page.

## Local checks

```powershell
npm install
npm test
npm run dev:fixture
```

Open `http://127.0.0.1:4173/rlcard/`.

## FindItem case study

The production route is `https://harryxin.com/projects/finditem`.

`projects/finditem/` is a vendored and adapted snapshot of the standalone
website at `D:\Claude\FindItem\website`. The standalone repository remains the
upstream source for the FindItem experience, but this copy also owns
harryxin.com-specific navigation, metadata, absolute asset paths, storage keys,
system-font policy, and honest deployment-status copy.

When syncing from the upstream website, port intentional changes selectively
and preserve those host-site adaptations. Do not overwrite the directory with
an unreviewed wholesale copy.

For a local check, run `npm run dev:fixture`, then open
`http://127.0.0.1:4173/projects/finditem/`.

## Runtime configuration

The production and preview environments require:

- `RLCARD_INGEST_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

`POST /api/rlcard/status` requires the ingestion token. `GET` is public and
returns only fields accepted by the server-side telemetry whitelist.

Secrets belong in Vercel environment variables or local ignored files. Never
commit them.
