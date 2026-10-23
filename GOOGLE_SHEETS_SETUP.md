# Connect Google Sheets

This uses a small Apps Script attached to your spreadsheet. You do not need to create a Google Cloud service account or download a JSON key.

## One-time setup

1. Open the Google spreadsheet you want to use.
2. Choose **Extensions → Apps Script**.
3. Replace the editor contents with [`apps-script/Code.gs`](apps-script/Code.gs), then save the project.
4. In Apps Script, open **Project Settings** (gear icon) → **Script Properties** → **Add script property**. Set the property name to `APP_ACCESS_KEY` and its value to a long random password. Keep it private.
5. Click **Deploy → New deployment**, choose **Web app**, set **Execute as** to **Me**, and allow access to **Anyone** if that option is available for your account. Click **Deploy** and approve the requested Google access.
6. Copy the deployment URL ending in `/exec`.
7. In Vercel, open **Project → Settings → Environment Variables** and add:
   - `GOOGLE_APPS_SCRIPT_URL` = the `/exec` deployment URL
   - `APP_ACCESS_KEY` = the exact same password you set in Script Properties
8. Redeploy the Vercel project. The first connection creates a `Calculations` tab automatically.

For local preview, copy `.env.example` to `.env.local`, set those same two values, restart `npm start`, enter the shared password in the app, and press **Connect**.

## How data is stored

The spreadsheet holds one row per saved term: record ID, save time, term, semester GPA, GPA credits, and course details as JSON. Loading a saved term and saving it again updates that row.

All people using the shared access key can read and update the same records. This setup does not provide Google sign-in or separate per-student accounts. Use it as a private shared calculator and avoid storing sensitive student information. Google Apps Script web apps run with the chosen deployment identity and access setting; see Google's [web app deployment guide](https://developers.google.com/apps-script/guides/web).
