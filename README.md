# MayoMix — Frontend

**A social space for music discovery, personal taste, and album reviews.**

MayoMix is a music discovery and social listening platform inspired by [Letterboxd](https://letterboxd.com/).

Discover albums, explore artists, build ranked music collections, write reviews, connect with other listeners, and explore the music your connections enjoy.

This repository contains the React frontend for MayoMix. It communicates with a separate [FastAPI backend](https://github.com/ammarbhat/mayomix) that handles authentication, user data, reviews, social connections, and music metadata.

## Features

### Authentication and profiles
- User registration and login.
- Session-based JWT authentication.
- Personal and public user profiles.
- Profile editing and account management.
- Favorite genre selection.
- Password and username management.
- Account deletion.

### Music discovery
- Search for albums, artists, and songs.
- Browse album details and tracklists.
- Discover highly rated albums.
- View album artwork and artist information.
- Explore music using MusicBrainz metadata.

### Reviews and ratings
- Rate albums.
- Write and edit album reviews.
- Browse album reviews from other users.
- View a user's complete review history.
- Display ratings through the application's custom rating interface.

### Personal taste
- Build ranked music collections.
- Organize favorite albums, artists, songs, and genres.
- Maintain rotating music selections.
- Like individual taste-list entries.
- Display curated collections on user profiles.

### Social features
- Search for other users.
- Send and accept connection requests.
- View pending and sent requests.
- Browse connected users' profiles.
- Explore the activity feed.
- Follow the reviews and musical activity of your connections.

### Performance and caching
- API response caching with TanStack Query.
- Token-scoped private query caches.
- Automatic query invalidation after mutations.
- Persistent MusicBrainz metadata caching.
- Service-worker-based album artwork caching.
- Profile artwork preloading.
- Lazy loading of album artwork and metadata.
- Skeleton states and loading indicators.

---

## Tech Stack

| Area | Technology |
|---|---|
| UI library | React 19 |
| Build tool | Vite 8 |
| Routing | React Router 8 |
| Server-state management | TanStack Query 5 |
| Styling | CSS |
| API communication | Fetch API |
| Music metadata | MusicBrainz |
| Album artwork | Cover Art Archive |
| Testing | Node.js Test Runner |
| Linting | ESLint 10 |
| Deployment | Netlify / Vite |

---

## Architecture

The frontend is organized around application-level configuration, reusable components, API utilities, and domain-specific pages.

### Project structure

```text
mayomix-f/
│
├── public/
│   ├── images/
│   └── service-worker.js
│
├── src/
│   ├── app/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── queryClient.js
│   │   ├── queryKeys.js
│   │   └── installSmoothScrolling.js
│   │
│   ├── api/
│   │   ├── api.js
│   │   └── musicBrainzCache.js
│   │
│   ├── components/
│   │   ├── feedback/
│   │   ├── layout/
│   │   ├── ratings/
│   │   └── reviews/
│   │
│   ├── data/
│   │
│   ├── hooks/
│   │
│   ├── pages/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── search/
│   │   ├── albums/
│   │   ├── reviews/
│   │   ├── activity/
│   │   ├── taste/
│   │   └── settings/
│   │
│   ├── styles/
│   │
│   └── assets/
│
├── tests/
│
├── index.html
├── package.json
├── vite.config.js
└── netlify.toml
```

---

## Application Routes

The application uses React Router for client-side navigation.

| Route | Description |
|---|---|
| `/` | Login and registration |
| `/login` | Authentication page |
| `/profile` | Current user's profile |
| `/users/:username` | Public user profile |
| `/users/:username/reviews` | User review history |
| `/search` | Search users and music |
| `/albums/:mbid` | Album details and reviews |
| `/activity` | Social activity and connection requests |
| `/taste` | Manage personal taste lists |
| `/edit-profile` | Edit profile information |
| `/settings/*` | Account and application settings |

---

## API Integration

The frontend communicates with the FastAPI backend through a centralized API client.

The main API implementation is located in:

```text
src/api/api.js
```

### API configuration

The API base URL is resolved using the following configuration:

1. `VITE_API_BASE_URL`, if provided.
2. `/api` during Vite development.
3. `https://mayomix.onrender.com` in production builds when no override is provided.

Example:

```env
VITE_API_BASE_URL=https://mayomix.onrender.com
```

During development, Vite proxies `/api` requests to:

```text
http://127.0.0.1:8000
```

The `/api` prefix is removed before forwarding requests to FastAPI.

### Authentication

MayoMix uses the backend's OAuth2 password flow.

The frontend sends login credentials as form-encoded data to:

```http
POST /token
```

The returned JWT access token is stored in `sessionStorage`.

Authenticated requests automatically include the bearer token:

```http
Authorization: Bearer <access_token>
```

Using `sessionStorage` means the authentication session does not persist after the browser tab's session ends.

### Centralized API client

The API client provides:

- A shared request implementation.
- Automatic authorization headers.
- JSON and text response handling.
- Consistent error extraction.
- Query caching.
- Mutation-based cache invalidation.
- Music metadata normalization.
- Artwork URL normalization.

Components and pages use shared API functions rather than independently implementing request logic.

---

## Data Fetching and Caching

MayoMix uses TanStack Query to manage server state and reduce unnecessary API requests.

### Query caching

The application maintains centralized query keys and configurable freshness policies.

Some examples:

| Resource | Freshness |
|---|---:|
| General API queries | 30 seconds |
| Album metadata | 24 hours |
| Reviews | 30 seconds |
| Public profiles | 30 seconds |
| Activity feed | 20 seconds |
| Search results | 30 seconds |
| Connection status | 15 seconds |
| Taste lists | Until invalidated |

The default query configuration also includes:

- One automatic retry.
- Five-minute garbage collection.
- No automatic refetch on window focus.

### Private query isolation

Private query keys are scoped using the authenticated user's ID extracted from the JWT.

This prevents private cached data from being shared between different authenticated accounts.

The application also removes private queries when authentication state changes and invalidates affected resources after successful mutations.

For example, submitting a review can invalidate:

- The corresponding album review collection.
- The user's review collection.
- The activity feed.

This keeps the interface synchronized without unnecessarily refetching every resource.

### MusicBrainz metadata cache

Music metadata is also cached independently of TanStack Query.

Implementation:

```text
src/api/musicBrainzCache.js
```

The cache uses browser `localStorage`.

Its configuration includes:

- 24-hour expiration.
- Maximum of 300 entries.
- Metadata-only storage.
- Automatic removal of expired entries.
- Cleanup of malformed and legacy cache data.

Only selected metadata fields are retained, rather than storing entire upstream responses.

### Album artwork caching

MayoMix implements a dedicated service worker:

```text
public/service-worker.js
```

It caches album artwork from the Cover Art Archive.

The artwork cache has:

- A 30-day maximum age.
- A maximum of 300 album artwork entries.
- A separate profile artwork cache.
- A profile artwork limit of 20 entries.
- Cache cleanup and expiration handling.

The service worker also supports profile artwork preloading through messages from the application.

This caching layer is specifically for artwork; it does not make the entire application available offline.

---

## Artwork Optimization

Album artwork is one of the most frequently requested resources in a music discovery application.

MayoMix includes additional optimizations to reduce unnecessary image requests.

### Artwork URL normalization

The API utility normalizes Cover Art Archive URLs to request appropriately sized artwork.

### Artwork proxy

During development, Vite provides a local artwork proxy for Cover Art Archive requests.

It also supports the configured HTTP LAN-development scenario.

The proxy:

- Fetches artwork from Cover Art Archive.
- Streams the response to the browser.
- Uses a 30-day browser cache policy.
- Handles unavailable artwork responses.

### Lazy loading

Artwork is loaded progressively using native image lazy loading and intersection observers.

Album metadata is also fetched on demand for selected content, rather than loading every album simultaneously.

---

## Getting Started

### Prerequisites

- Node.js compatible with Vite 8.
- npm.
- A running MayoMix FastAPI backend.

Backend repository:

https://github.com/ammarbhat/mayomix

### 1. Clone the repository

```bash
git clone https://github.com/ammarbhat/mayomix-f.git

cd mayomix-f
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the backend

Follow the backend repository's installation instructions.

By default, the frontend expects the backend at:

```text
http://127.0.0.1:8000
```

### 4. Start the frontend

```bash
npm run dev
```

Vite will display the local development URL, typically:

```text
http://localhost:5173
```

The development server listens on all network interfaces, allowing access from other devices on the same local network.

### 5. Production build

Generate an optimized production build:

```bash
npm run build
```

The resulting files are generated in:

```text
dist/
```

Preview the production build locally:

```bash
npm run preview
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Generate the production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run automated tests |

---

## Deployment

MayoMix is designed to be deployed as a static frontend application.

### Production API

The production API defaults to:

```text
https://mayomix.onrender.com
```

You can override this by configuring:

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

Remember that Vite environment variables prefixed with `VITE_` are exposed to client-side code. Do not put secrets in them.

### Netlify

The repository includes a `netlify.toml` configuration:

```toml
[[redirects]]
  from = "/*"
  to = "index.html"
  status = 200
```

This ensures that client-side routes are redirected to the application's entry point instead of returning a server-side 404.

For deployment:

1. Connect the repository to Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.
4. Configure `VITE_API_BASE_URL` if the default backend URL is not being used.
5. Deploy the application.

The backend must also allow requests from the deployed frontend origin.

---

## Testing

The project uses Node.js's built-in test runner.

Tests are executed using:

```bash
npm test
```

The current test coverage includes MusicBrainz metadata cache behavior, including:

- Cache expiration.
- Maximum cache size.
- Oldest-entry eviction.
- Metadata-only storage.
- Malformed cache handling.
- Legacy cache cleanup.

---

## Current Limitations

Some areas can still be improved:

- No dedicated end-to-end browser testing suite.
- No complete offline application experience.
- Authentication uses session-scoped JWT storage.
- Search and metadata discovery depend on external services.
- Production API configuration must remain synchronized with the backend deployment.
- Some frontend functionality depends on the backend's existing empty-result response conventions.

---

## Related Repository

**Backend:** [ammarbhat/mayomix](https://github.com/ammarbhat/mayomix)

The backend is built with FastAPI, SQLAlchemy 2.0, PostgreSQL/SQLite, and Alembic.

It handles authentication, user data, music metadata, reviews, taste lists, and social connections.

---

## Credits

- [MusicBrainz](https://musicbrainz.org/) — Music metadata.
- [Cover Art Archive](https://coverartarchive.org/) — Album artwork.
- [React](https://react.dev/) — UI library.
- [Vite](https://vite.dev/) — Development and build tooling.
- [TanStack Query](https://tanstack.com/query/latest) — Server-state management.

---

## License

See the repository's license file for licensing information.