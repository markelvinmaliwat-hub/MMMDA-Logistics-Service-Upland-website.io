PLDT DASHBOARD  ->  GOOGLE SHEET  (setup, ~3 minutes)
=====================================================

The dashboard (index.html) is already pointed at your web app:
  https://script.google.com/macros/s/AKfycbwNG8pirHbssES5uzrx3y_W_Ko7P1EUsAlBxrckFHFd4vTET4Z6z8EVmkRpEEgJ25N1vQ/exec
and the script is pointed at your sheet:
  11-VVgEX5ugFP4suckiaV_LitXz2VhuYe3HhDv4rLcdA

The ONLY thing left is to put apps-script/Code.gs behind that web app URL:

1. Open your Google Sheet > Extensions > Apps Script.
2. Delete everything in the editor, paste the whole of apps-script/Code.gs, click Save.
3. Select the function "setup" in the toolbar and click Run.
   Approve the permission prompt (Advanced > Go to project > Allow).
   This creates the tabs Activity_Log, Payment_Log and Accounts.
4. Deploy > Manage deployments > (pencil icon) on your existing Web app
   > Version: "New version" > Deploy.
   Keep: Execute as = Me, Who has access = Anyone.
   (Editing the existing deployment keeps the same /exec URL, so index.html needs no change.)
   If you create a NEW deployment instead, paste its new /exec URL into the
   LOG_URL line near the bottom of index.html.
5. Quick check: open the /exec URL in a browser. You should see
   {"ok":true,"status":"Dashboard backend is running"}
6. Upload index.html (or pldt_dashboard.html - they are identical) to your hosting.

WHAT NOW GOES TO THE SHEET
- Activity_Log : log in / log out / failed login / sign up / searches / views, per agent
- Payment_Log  : every "For payment" action and remark (everyone sees the same data)
- Accounts     : sign-ups, so an agent can log in from any phone or PC

Accounts created before this update (saved in an agent's own browser) are copied to the
sheet automatically the first time that agent logs in on that same browser.

Optional: in index.html set ADMIN_EMAILS=['you@email.com'] so only those emails see
everyone's activity in the app (empty = every logged-in agent sees all).
Note: the Activity_Log / Payment_Log tabs in the Sheet itself are visible to anyone you share the Sheet with.
