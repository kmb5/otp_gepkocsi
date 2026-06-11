import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const PORT    = process.env.PORT ?? 3000;
const OTP_API = 'https://www.otpbank.hu/apps/composite/api/carsweepstakes/check/';

const app = express();

// ── Static files ──────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'public')));

// ── Proxy endpoint ────────────────────────────────────────────────
app.get('/check/:id', async (req, res) => {
  const { id } = req.params;

  if (!/^\d{6,12}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const upstream = await fetch(`${OTP_API}${id}`);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    const data = await upstream.json();
    res.json(data);

  } catch (err) {
    console.error(`[check/${id}]`, err.message);
    res.status(502).json({ error: 'Could not reach OTP API' });
  }
});

app.listen(PORT, () => console.log(`→  http://localhost:${PORT}`));
