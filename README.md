# Cyber Weather

A daily "weather forecast" for the internet. It reads CISA's catalog of vulnerabilities that attackers are **actively exploiting right now** and turns it into a simple threat level, from **Clear skies** to **Severe storms**.

- **Live data:** pulls the newest CISA catalog when it starts and every 6 hours after that
- **Threat radar and 14-day record:** see how busy the week has been
- **Your local forecast:** add the vendors you use (Microsoft, Fortinet, Chrome…) and matching alerts get flagged
- **Forecast API:** the same forecast as JSON, for other tools or a phone widget
- **Installs like an app:** add it to your phone's home screen with its own icon; works offline with the last forecast
- **No extra packages:** it only needs Node.js

---

## 1. Run it on your computer

**You need:** Node.js version 18 or newer. Get it from [nodejs.org](https://nodejs.org) (choose the "LTS" download and click through the installer).

1. Unzip the `cyber-weather` folder somewhere easy, like your Desktop.
2. Open a terminal:
   - **Windows:** open the folder, click the address bar, type `cmd` and press Enter.
   - **Mac:** open Terminal, type `cd ` (with a space), drag the folder into the window, press Enter.
3. Start the app:
   ```
   npm start
   ```
4. Open **http://localhost:3000** in your browser.

To stop it, go back to the terminal and press `Ctrl + C`.

> If you see `Cyber Weather is running at http://localhost:3000`, it worked. The first few seconds show a bundled snapshot while it downloads the latest data.

---

## 2. Put it online for free (Render)

This gives you a real web address anyone can visit.

### Step A: Put the code on GitHub
1. Make a free account at [github.com](https://github.com).
2. Click **+** (top right) → **New repository**. Name it `cyber-weather`, leave it **Public**, click **Create repository**.
3. On the next page click **uploading an existing file**.
4. Drag **everything inside** the `cyber-weather` folder (not the folder itself) onto the page. Click **Commit changes**.

### Step B: Deploy on Render
1. Make a free account at [render.com](https://render.com) and choose **Sign in with GitHub**.
2. Click **New +** → **Blueprint**.
3. Pick your `cyber-weather` repository. Render reads `render.yaml` and fills in the settings for you.
4. Click **Apply** (or **Deploy**). Wait a minute or two.
5. Click the link Render shows (something like `https://cyber-weather-xxxx.onrender.com`). That's your live app.

**Good to know:** free Render apps go to sleep after about 15 minutes with no visitors. The next visit takes up to a minute to wake it, then it fetches fresh data automatically.

### Step C: Install it on your phone
Open your Render link on your phone, then:
- **iPhone (Safari):** tap the **Share** button → **Add to Home Screen** → **Add**.
- **Android (Chrome):** tap the **⋮** menu → **Add to Home screen** (or **Install app**).

Cyber Weather now has its own icon and opens full screen like any other app. If you lose signal, it shows the last forecast it saw.

On a computer, Chrome and Edge show an install icon at the right end of the address bar that does the same thing.

### Updating the app later
Edit or re-upload files on GitHub. Render redeploys automatically after each change.

---

## 3. The forecast API

| Address | What you get |
|---|---|
| `/api/forecast` | Today's level, counts, top vendors, 14-day history and the new alerts from the last 7 days |
| `/api/forecast?stack=Microsoft,Fortinet` | Same, plus a personal forecast for those vendors |
| `/api/kev` | The full past year of exploited vulnerabilities the page uses |
| `/health` | Whether the server is up and when data was last fetched |

Example piece of `/api/forecast`:
```json
{
  "observed": "2026-10-30",
  "level": { "key": "warn", "name": "Severe storms", "alert": "Cyber warning" },
  "newLast7Days": 10,
  "ransomwareLast7Days": 0,
  "percentileVsPastYear": 87
}
```

---

## 4. How the forecast works

1. Count the vulnerabilities CISA added in the last 7 days.
2. Compare that with every 7-day stretch in the past year.
3. Pick the level by where this week ranks:

| This week ranks in the… | Level |
|---|---|
| bottom 35% | Clear skies |
| 35–60% | Partly cloudy (cyber advisory) |
| 60–85% | Storm watch (cyber watch) |
| top 15% | Severe storms (cyber warning) |

4. If 2 or more of this week's additions are linked to ransomware, raise the level one step.

The math lives in `public/forecast.js`. The website and the API both use this same file, so they always agree.

---

## Project layout

```
cyber-weather/
├── server.js            the web server and API
├── lib/kev.js           downloads and caches the CISA catalog
├── public/index.html    the website
├── public/forecast.js   forecast math (shared by website and server)
├── public/manifest.webmanifest, sw.js, icons/   what makes it installable as an app
├── data/kev-snapshot.json   backup copy of the data, used if CISA can't be reached
├── test/                automated checks (run: npm test)
├── render.yaml          settings for Render hosting
└── Start Cyber Weather.bat   double-click to run it on Windows
```

## Settings

| Setting | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Which port the server listens on (Render sets this for you) |
| `REFRESH_HOURS` | `6` | How often to download fresh CISA data |

## Ideas for version 2
- Email or text alerts when a new vulnerability matches your stack
- Accounts so your stack follows you across devices
- A phone home-screen widget that reads `/api/forecast`

---

Data: [CISA Known Exploited Vulnerabilities catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog). Patch-by dates are CISA's deadlines for U.S. federal agencies. The forecast is a rough gauge, not a risk assessment of your environment.
