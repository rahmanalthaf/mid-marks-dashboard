# Mid Marks Dashboard

A small React app for entering mid-term marks across 6 subjects and seeing
percentage, grade, and a pass/fail dashboard update live. Data is saved to
your browser's local storage.

## Run locally

npm install
npm run dev

Then open the local URL Vite prints (usually http://localhost:5173).

## Build for production

npm run build

This outputs a static site to the `dist` folder, which you can deploy
anywhere (GitHub Pages, Netlify, Vercel, etc).

## Deploying with GitHub Actions

This repo includes `.github/workflows/deploy.yml`, which automatically
builds the app and publishes it to GitHub Pages every time you push to
`main`. No local build step needed.

One-time setup after pushing this repo to GitHub:
1. Go to the repo's **Settings** tab.
2. Click **Pages** in the left sidebar.
3. Under "Build and deployment", set **Source** to **GitHub Actions**.
4. Push a commit (or re-run the workflow from the **Actions** tab).
5. The workflow will show a URL like `https://<username>.github.io/<repo>/`
   once it finishes.
