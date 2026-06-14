import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const PORT    = process.env.PORT ?? 3000;
const OTP_API = 'https://www.otpbank.hu/apps/composite/api/carsweepstakes/check/';

const app = express();
app.set('trust proxy', 1); // trust first hop (Caddy)
app.use(helmet());
app.use('/check', cors({ origin: 'https://otp.bendeguzkovacs.com' }));

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60_000,       // 1 minute window
  max: 30,               // max 30 requests per IP per window
  standardHeaders: true, // return RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in a minute' },
});

app.use('/check', limiter);

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
