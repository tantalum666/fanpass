# FanPass Web

This is the ITP4457 coursework fork of the original FanPass web prototype. It keeps the FanPass verified ticket idea, but presents tickets and event add-ons as normal purchasable products for an online purchase system.

Coursework-specific handoff notes live in `SCHOOL_WEB_HANDOFF.md`. Keep those notes separate from the main FanPass product handoff under `docs/`.

## Architecture

- Presentation tier: React, Vite, HTML5 and CSS in `src/`.
- Business logic tier: Express REST API in `server/index.js`.
- Persistence tier: MongoDB when `MONGODB_URI` is provided, otherwise a local JSON fallback in `.school-data/`.

## Required Accounts

- Administrator: `tuser`
- Password: `tpass`
- Example member: `Alex Chen`
- Password: `member123`

## Features

- Guest: product search, product listing, add/update/remove cart items, checkout prompt before payment.
- Member: register, login, logout, change password, preserved guest cart checkout, transaction history, purchased-product comments.
- Administrator: product create/update/disable with image upload, user list/update/disable, transaction list/update/disable, comment list/disable.

## Run

```bash
npm install --prefix archive/school-project/school-web
npm run dev --prefix archive/school-project/school-web
```

Open `http://localhost:5174`.

To use MongoDB instead of the JSON fallback:

```bash
MONGODB_URI="mongodb://127.0.0.1:27017" MONGODB_DB="fanpass_school" npm run dev --prefix archive/school-project/school-web
```

## Build

```bash
npm run typecheck --prefix archive/school-project/school-web
npm run build --prefix archive/school-project/school-web
```
