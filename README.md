# Product System — API

The backend for the product database: Express + Google Sheets (product data) + MongoDB (authentication only) + Cloudinary (image URLs only).

This is a standalone repository, deployed independently from the frontend (see `product-system-web`). Full setup guide is in the main handoff document.

## Local development

```bash
cp .env.example .env    # fill in every value
npm install
npm run sheets:init     # creates the Products / Categories / Suppliers / Settings tabs
npm run auth:create-user
npm run dev
```

Server runs on http://localhost:4000 by default.
