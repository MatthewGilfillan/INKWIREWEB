# Google Drive course import

Ink Wire can read a teacher-selected private Drive folder, list supported documents in its subfolders, and import selected files into the existing private OpenAI course resource library. The teacher then chooses **Prepare whole course**. Local files and synced-folder uploads work without this setup.

## Administrator setup

1. In your Google Cloud project, enable **Google Drive API**.
2. Configure Google Auth Platform branding, audience and data access. Add `https://www.googleapis.com/auth/drive.readonly`. This is a restricted scope allowing read/download access to Drive, not a folder-scoped permission. Ink Wire traverses only the entered folder. For testing, add your teacher Google account as a test user. Complete Google's required verification and security assessment before broad public use; do not ask teachers to bypass an unverified-app warning.
3. Create a **Web application** OAuth client with authorized JavaScript origin `https://inkwire-education.com`. No redirect URI or client secret is needed for this browser token flow. For local testing, add the exact localhost origin separately.
4. Set the non-secret Cloudflare Worker variable `GOOGLE_DRIVE_CLIENT_ID` to the OAuth client ID, and deploy. Retain it in deployment configuration so later Git builds do not remove it. Never put a client secret in browser code.
5. In a teacher course, open **Prepare Course with AI → Import a private Google Drive folder**, paste the folder link, connect the Google account, select files and import. Verify with a small test folder containing a PDF and a Google Doc before using live materials.

## Behaviour and limits

- Google access tokens live only in this browser tab, never in cookies, local storage, Ink Wire's database, logs or OpenAI requests. The browser downloads from Google's API and uploads only the selected file content to Ink Wire. Disconnect revokes the current token. Imported files persist until removed from course resources.
- Google Docs and Slides export as PDF; Sheets export as XLSX. PDF, Word, CSV, Excel, TXT and VTT files retain their format. Google's export-size limit also applies.
- Scan limit: 50 folders and 500 items. Shortcuts are not followed. The user sees supported files before import. No Drive files are modified.
- Existing course limits apply: eight resources, 40 MiB total, 20 MiB per file. Larger studies should be divided into relevant excerpts.
- Google login domains are permitted by the teacher-page content security policy only when the client ID is configured. Student, parent and account pages retain their existing policy.

References: [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [downloads and exports](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
