# Workout Web

PWA for iOS and other non-Android users. Independent from the Android app; both apps read the same workout catalog from GitHub (`Workout_v2_admin_data`).

## Features

- Username + 4-digit PIN signup/login (any device)
- Sync exercises/templates/media from shared Git catalog
- Add plans by template code, template list, or **custom plan**
- Browse days → exercises → log sets/reps/weight (or timed)
- Exercise detail: GIFs, images, YouTube, history
- Custom plan editor (days, exercises, targets)
- Deleting a plan also deletes its logs

## Stack

| Layer | Service |
|-------|---------|
| Hosting | Vercel |
| Auth API | Vercel serverless (`/api/login`, `/api/signup`) |
| User data | Firebase Firestore |
| Sessions | Firebase Auth |
| Catalog | GitHub raw JSON (same repo as Android) |

## Setup

### 1. Firebase

1. Create project → enable **Authentication** (no providers needed)
2. Create **Firestore** → publish rules from `firestore.rules`
3. Register a **Web app** → copy config into `.env.local`
4. **Service accounts** → download JSON key

### 2. Local env

```bash
cd Workout_web
npm install
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GIT_REPO_URL=https://github.com/pranith308/Workout_v2_admin_data.git
FIREBASE_SERVICE_ACCOUNT_PATH=C:/Users/you/Downloads/your-firebase-adminsdk.json
```

On Vercel, use `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON, one line) instead of the path.

### 3. Run locally

```bash
npx vercel login          # once
npm run dev:full          # http://localhost:3000
```

## Access control

- **Invite code** (`INVITE_CODE` env): required for **Create account** and **Forgot PIN**
- **Max users** (`MAX_USERS`, default 10): blocks new signups after the cap
- Share the invite code only with people you trust; change it anytime in Vercel env vars

## Custom URL (Vercel subdomain)

Underscores are **not** allowed in hostnames. Use a hyphen:

1. Vercel project → **Settings → Domains**
2. Add `workout-v2.vercel.app` (or rename the project so the default URL matches)
3. Or connect your own domain (e.g. `workout.yourdomain.com`)

Current production URL: `https://workout-web-orcin.vercel.app`

## Forgot PIN

Login → **Forgot PIN?** → username + invite code + new PIN → signed in.

1. Create a GitHub repo for this folder and push `main`
2. [Vercel](https://vercel.com) → Import that repo (project already linked locally as `workout-web` if you ran `vercel dev`)
3. **Settings → Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_FIREBASE_API_KEY` | from Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | from Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | from Firebase web config |
| `VITE_FIREBASE_APP_ID` | from Firebase web config |
| `VITE_GIT_REPO_URL` | `https://github.com/pranith308/Workout_v2_admin_data.git` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | entire service account JSON as **one line** |

Do **not** set `FIREBASE_SERVICE_ACCOUNT_PATH` on Vercel (file paths don’t exist there).

4. Redeploy after adding env vars
5. Open the Vercel URL → Create account → Sync catalog → Add plan
6. On iPhone: Safari → Share → **Add to Home Screen**

### One-line JSON helper (PowerShell)

```powershell
(Get-Content "C:\path\to\firebase-adminsdk.json" -Raw) -replace '\s+', ' ' | Set-Clipboard
```

Paste into the Vercel env value for `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Firestore layout

```
users/{uid}              profile (username, createdAt)
userSecrets/{uid}        pinHash (server only)
usernames/{usernameKey}  uid lookup (server only)
users/{uid}/plans/{id}   UserWorkoutPlan
users/{uid}/logs/{id}    WorkoutLogEntry
loginAttempts/{username} rate limiting (server only)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite only (no auth API) |
| `npm run dev:full` | Vercel + Vite (auth API works) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |

## Related repos

- [Workout_v2](https://github.com/pranith308/workout_v2) — Android app
- [Workout_v2_admin_data](https://github.com/pranith308/Workout_v2_admin_data) — shared catalog

## Later (optional)

- UI polish to match Android more closely
- GitHub repo + first production deploy
- Progress charts
