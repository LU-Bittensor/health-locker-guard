# MedShare Portal

Can you make me a basic front end only for accessing, uploading, and giving permissions to access medical data

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c307f043-363f-452d-a7ef-1adc3798e70b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Backend boundary

Database migrations/tests/configuration and the authoritative Solidity contract now live in `../backend`. Server-only Supabase authentication/admin helpers are also there. See [backend layout](../backend/README.md).

The frontend retains TanStack SSR/startup integration, React UI, and browser API clients. Its database types module re-exports shared schema declarations from `../backend/supabase/types.ts`. Keep both sibling folders available when building the frontend.
