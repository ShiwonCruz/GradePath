# Google Sheets setup

The browser talks only to `/api/records`. Google credentials stay in the server environment and are never sent to browser code.

## 1. Prepare the spreadsheet

1. Create or choose a Google spreadsheet.
2. Create a worksheet tab named **Calculations**. The app writes its header row automatically when this tab is empty.
3. Copy the spreadsheet ID from the URL. It is the text between `/d/` and `/edit`.

## 2. Create server credentials

1. In Google Cloud Console, create or choose a project and enable the **Google Sheets API**.
2. Create a service account and a JSON key for it.
3. Share the spreadsheet with the service account email from the JSON file and give it **Editor** access.

The API uses a server-to-server service account token with the Sheets scope. Do not commit the JSON key or place it in client-side code.

## 3. Configure the app

Set these environment variables in Vercel under **Project → Settings → Environment Variables**, then redeploy:

- `GOOGLE_SHEETS_ID`: spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: service account `client_email`
- `GOOGLE_PRIVATE_KEY`: service account `private_key`; keep it server-side. If entering it as one line, preserve newlines as literal `\n` sequences.
- `APP_ACCESS_KEY`: a long random shared password for access to this shared spreadsheet

For local preview, copy `.env.example` to `.env.local` and replace the values. `.env.local` is ignored by Git. Restart `npm start`, open the app, enter `APP_ACCESS_KEY` in the connection panel, and choose **Connect**.

## Data and access model

All visitors who know the same shared access key see and can update the same spreadsheet records. This is a small shared-record prototype; it does not provide Google sign-in or separate per-student accounts. Do not store sensitive student information in this shared setup.

The **Calculations** tab stores one row per saved term: record ID, save time, term, semester GPA, GPA credits, and the course details as JSON. Saving a loaded record updates that row; saving a new term adds a row.
