# RigThermal

Custom PC power budget and thermal calculator. Pick a CPU, GPU, memory, storage and cooling, and RigThermal shows the base TDP, the recommended PSU size, heat output in BTU/hr, and the monthly electricity cost. Builds can be saved in the browser and optionally synced to a Neon PostgreSQL table through a Netlify serverless function.

- React, Tailwind CSS, Framer Motion and Lucide icons, loaded from CDNs. There is no build step.
- One Netlify Function (`netlify/functions/builds.mjs`) that talks to Neon.
- Saved rigs always work offline in `localStorage`. Sync is optional.

## The formulas

```
Base System TDP      = sum of component wattages
Recommended PSU (W)  = Base TDP x 1.20
Thermal output       = Recommended PSU (W) x 3.41214      (BTU/hr)
Monthly usage (kWh)  = Recommended PSU (W) x hours x 30 / 1000
Monthly cost         = Monthly kWh x electricity rate
```

Run `npm test` to check them.

## Project layout

```
rigthermal/
├─ public/
│  ├─ index.html           page shell, loads the libraries
│  ├─ styles.css           design tokens and component styles
│  ├─ tailwind-config.js   Tailwind colors and fonts
│  ├─ logic.js             hardware data and formulas (pure functions)
│  └─ app.js               React UI
├─ netlify/functions/
│  └─ builds.mjs           POST saves a build, GET is a health check
├─ test/logic.test.mjs     formula tests
├─ schema.sql              Neon table
├─ netlify.toml
├─ package.json
└─ .env.example
```

## Set up Neon (the database)

1. Go to https://console.neon.tech and choose **New project**. Pick the region closest to your users.
2. Open the **SQL Editor** for that project, paste the contents of `schema.sql`, and run it. This creates the `builds` table.
3. Click **Connect** on the project dashboard and copy the connection string. It ends in `?sslmode=require`. The pooled string (host contains `-pooler`) works fine.

## Deploy to Netlify

1. Push this folder to a new GitHub repository.
2. In Netlify choose **Add new site, Import an existing project**, and pick the repository. The settings come from `netlify.toml`, so leave the build command empty. Publish directory is `public`.
3. Before the first deploy, or afterwards followed by a redeploy, open **Site configuration, Environment variables** and add:
   - Key: `NEON_DATABASE_URL`
   - Value: the connection string from Neon
   - Scope: make sure **Functions** is included, and mark it secret if Netlify offers the option.
4. Deploy. Netlify installs `@neondatabase/serverless` automatically from `package.json`.

You can also deploy without GitHub using the Netlify CLI: `npm install -g netlify-cli`, then `netlify deploy --prod`.

## Check that it works

- Open `https://YOUR-SITE.netlify.app/.netlify/functions/builds`. You should see `{"ok":true}`.
- Open the site. The header badge changes from **Local mode** to **Neon connected**.
- Save a rig with **Save and sync to Neon**, then run this in the Neon SQL Editor:

```sql
SELECT * FROM builds ORDER BY created_at DESC;
```

## Run locally

```bash
npm install -g netlify-cli
npm install
cp .env.example .env        # then put your real Neon string in .env
netlify dev
```

`netlify dev` serves `public/` and runs the function at `http://localhost:8888/.netlify/functions/builds`. Opening `public/index.html` directly also works for the calculator, but sync needs `netlify dev`.

## How sync works

When you press **Save and sync to Neon** (or **Sync** on a saved rig), the page sends:

```json
{
  "name": "Weekend render box",
  "cpu": "AMD Ryzen 7 5700X",
  "gpu": "NVIDIA RTX 3060",
  "total_wattage": 311,
  "btu_hr": 1273.4,
  "monthly_cost": 1074.82
}
```

`total_wattage` is the base TDP. `monthly_cost` is in whichever currency was selected when the rig was saved, and the table has no currency column. The description you type stays in the browser, because the table has no column for it. If you want it in the database, add `description TEXT` to the table and extend `builds.mjs` and `pushToNeon` in `public/app.js`.

## Things to know before going public

- **The endpoint is open.** Anyone who finds the URL can insert rows. The function validates and length-limits every field and accepts inserts only, but add rate limiting or a shared-secret header if you expect abuse.
- **There is no list or delete route.** View and remove rows in the Neon console. Deleting a rig in the app removes only the browser copy.
- **No accounts.** Synced rows are not tied to any user, so the Privacy Policy tells visitors not to put personal information in rig names.
- **Fill in the contact line.** The last section of the Privacy Policy (in `POLICY` inside `public/app.js`) says to replace a placeholder with your email address.
- **Third-party loads.** Fonts come from Google Fonts and scripts from cdnjs, jsDelivr and the Tailwind CDN. The Tailwind CDN script is meant for prototypes. To remove that dependency, compile Tailwind yourself and ship the CSS.

## Customizing the hardware list

Edit `CPUS`, `GPUS`, `BOARDS` and the per-part wattages at the top of `public/logic.js`. Each entry is `{ id, name, w }`. TDP is a rating, not peak draw, which is what the 20% headroom is for.
