# appointment-manager

Frontend-only Angular dashboard for appointment booking, live reception operations, and weekly practice-owner metrics.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4200/`.

## Build

```bash
npm run build
```

## Active Pages

- `/` - Dashboard overview
- `/book-appointment` - Appointment booking calendar powered by `angular-calendar`
- `/dashboard` - Live operations and weekly performance metrics

## Archived Code

The previous backend, Prisma database setup, authentication pages, original landing page, SSR server, and generated Prisma client were moved into `old/` so they stay available as reference without being part of the active application.
