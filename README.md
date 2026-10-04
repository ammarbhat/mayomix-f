# MayoMix

## Pages

The login page is at `/` (or `/login`). The profile page is at `/profile`.

The profile loads the signed-in user's name, photo, genres, and taste lists from the FastAPI service at `http://127.0.0.1:8000`. Keep that API running; Vite proxies `/api` requests to it during development and preview.

To view the production build locally:

```sh
npm.cmd run build
npm.cmd run preview
```

Open the URL printed by Vite (usually `http://localhost:4173/` for login or `http://localhost:4173/profile` for the profile). Keep the preview command running while you view the pages.

For live development, run `npm.cmd run dev` and open the Vite URL with `/profile` appended.

## Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
