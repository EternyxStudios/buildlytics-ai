# Buildlytics AI — GitHub Pages Build

A responsive browser-based analytics project studio.

## What works in this build

- Premium dashboard UI
- CSV upload + local dataset scan
- Excel upload through SheetJS CDN
- Project suggestions based on detected data domain
- Single-tool projects: Power BI, SQL, Python, Excel, Tableau, ML
- Company-style project workspace
- Project Commander / task progress
- Explain mode + interview practice
- Local Project Verify checks
- Saved projects with localStorage
- ZIP, README and report exports
- Dark/light theme
- Mobile responsive layout
- GitHub Pages compatible

## Important limitation

GitHub Pages is static hosting. Secure login, real owner-role verification, database accounts, payments, cloud project storage and real server-side AI generation require a backend deployment. Those features are intentionally not faked in this Pages build.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js` and this README to the repository root.
3. Open repository **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`.
6. Save and wait for the public URL.

## Local preview

Open `index.html` in a browser. CSV works locally. Excel parsing needs internet because SheetJS is loaded from CDN.
