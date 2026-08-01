# harryxin.com

Static personal site with a Vercel Function-backed RLCard telemetry page.

## Local checks

```powershell
npm install
npm test
npm run dev:fixture
```

Open `http://127.0.0.1:4173/rlcard/`.

## Runtime configuration

The production and preview environments require:

- `RLCARD_INGEST_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

`POST /api/rlcard/status` requires the ingestion token. `GET` is public and
returns only fields accepted by the server-side telemetry whitelist.

Secrets belong in Vercel environment variables or local ignored files. Never
commit them.
