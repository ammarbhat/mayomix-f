# Mayomix

Mayomix is a music discovery and social listening frontend. Create a profile, build ranked taste lists, find albums and people, rate and review albums, and follow what your connections are listening to.

This repository contains the React frontend. It uses a separate FastAPI backend for accounts, authentication, reviews, taste lists, connections, and MusicBrainz-backed search and album data.

## Features

- Sign up and sign in with a Mayomix account.
- View your profile and public user profiles, including favorite genres and ranked music lists.
- Edit profile details and manage account settings.
- Search for users, albums, artists, and songs.
- Open album pages, rate albums, and write reviews.
- Browse your reviews and activity from connected users; send and manage connection requests.
- Organize favorite music into taste lists and mark liked entries.

## Tech stack

- React 19
- Vite 8
- TanStack Query
- FastAPI backend
- MusicBrainz metadata and Cover Art Archive artwork

## Requirements

- Node.js and npm
- The Mayomix FastAPI backend running locally at `http://127.0.0.1:8000`

The frontend uses Vite's `/api` proxy for backend requests. The proxy target is currently set in `vite.config.js`; the backend must allow the frontend origin if you call it directly from a browser.

## Getting started

Install dependencies:

```sh
npm install
```

Start the FastAPI backend, then run the frontend development server:

```sh
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). Vite is configured to listen on all network interfaces, so it can also be reached from another device on the same network using the host machine's LAN address and the port shown by Vite.

## Pages

| Path | Page |
| --- | --- |
| `/` or `/login` | Sign in or create an account |
| `/profile` | Your profile |
| `/users/:username` | Public profile |
| `/users/:username/reviews` | A user's album reviews |
| `/search` | Search MayoMix users and music |
| `/albums/:mbid` | Album details, ratings, and reviews |
| `/activity` | Connected users' activity and connection requests |
| `/taste` | Manage your ranked taste lists |
| `/edit-profile` | Edit profile information and taste selections |
| `/settings` | Account settings and related settings pages |

## Available scripts

```sh
npm run dev      # Start the Vite development server
npm run build    # Create a production build in dist/
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
npm test         # Run the Node test suite
```

On Windows PowerShell, use `npm.cmd` if script execution blocks `npm`, for example `npm.cmd run dev`.

## Backend and API notes

- The backend base URL defaults to `http://127.0.0.1:8000` through the Vite proxy in `vite.config.js`.
- Frontend API requests go through `/api`, which Vite rewrites to the backend during development and preview.
- Login uses the backend's OAuth2 form-encoded `POST /token` endpoint. The bearer token is stored in `sessionStorage` for the current browser session.
- The backend also contacts MusicBrainz and Cover Art Archive for catalog metadata and artwork.
- The backend integration guide and live API schema (`/docs`) are the source of truth for endpoint behavior. Some backend list endpoints return `404` for empty results.

There is no production API URL configured in this repository. For a deployed frontend, configure the API origin and backend CORS policy for that environment before release; the current Vite proxy is intended for local development and preview.

## Project layout

```text
src/          React pages, shared components, API helpers, and styles
public/       Static images and service worker
tests/        Node tests for API and MusicBrainz caching helpers
vite.config.js Vite development/preview configuration and local proxies
```
