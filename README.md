# OTP Car Sweepstake Checker

Checks OTP Bank car sweepstake entry numbers against the official API. An Express server proxies requests to the OTP API (bypassing CORS) and serves the static frontend from the same origin.

## Structure

```
otp_gepkocsi/
├── public/          # static frontend
│   ├── index.html
│   ├── style.css
│   └── script.js
├── deploy/
│   ├── nginx.conf               # nginx reverse proxy config
│   └── otp-gepkocsi.service     # systemd unit file
├── server.js        # Express server
├── package.json
└── .gitignore
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`node --watch` automatically restarts the server when `server.js` changes.

---

## Production deployment (Hetzner VPS)

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # must be >= 18
```

### 2. Clone the repo

```bash
cd ~
git clone https://github.com/YOUR_USER/otp_gepkocsi.git
cd otp_gepkocsi
npm install --omit=dev
```

### 3. Set up the systemd service

In `deploy/otp-gepkocsi.service`, replace both occurrences of `YOUR_USER` with your actual username, then:

```bash
sudo cp deploy/otp-gepkocsi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable otp-gepkocsi
sudo systemctl start otp-gepkocsi
sudo systemctl status otp-gepkocsi   # verify it's running
```

Follow logs:
```bash
journalctl -u otp-gepkocsi -f
```

### 4. Set up nginx

```bash
sudo apt-get install -y nginx
```

In `deploy/nginx.conf`, replace `YOUR_DOMAIN_OR_IP` with your domain or server IP, then:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/otp-gepkocsi
sudo ln -s /etc/nginx/sites-available/otp-gepkocsi /etc/nginx/sites-enabled/
sudo nginx -t          # test config
sudo systemctl reload nginx
```

### 5. HTTPS via Let's Encrypt — optional but recommended

Only works with a domain name (not a bare IP):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot automatically updates the nginx config and sets up auto-renewal.

---

## Updating

```bash
cd ~/otp_gepkocsi
git pull
npm install --omit=dev
sudo systemctl restart otp-gepkocsi
```
