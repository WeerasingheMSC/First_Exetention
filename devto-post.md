---
title: "NodeForge ⚡ — Stop Writing Boilerplate. Generate a Full Node.js/Express Backend in Seconds"
published: true
description: "A VS Code extension that scaffolds production-ready Node.js/Express backends with MongoDB, MySQL, PostgreSQL, JWT Auth, TypeScript/JavaScript support — right from your sidebar."
tags: nodejs, vscode, typescript, javascript
cover_image: https://raw.githubusercontent.com/WeerasingheMSC/First_Exetention/74376e2013acdb0b59acad6656abbfdba2081994/Untitled%20design%20(3).gif
canonical_url: 
---

How many times have you started a new backend project and spent the first two hours writing the same `express`, `mongoose`, `jwt`, `bcrypt` boilerplate — before writing a single line of actual business logic?

I got tired of it. So I built **NodeForge**.

---

## What is NodeForge?

**NodeForge** is a VS Code extension that generates production-ready **Node.js / Express** backends directly from an interactive sidebar — no CLI, no templates to clone, no copying old projects.

Pick your database, your language, your architecture, define your module fields, hit **Generate** — and you have a fully wired backend in seconds.

> **Install it:** [NodeForge on the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SahanCW.node-forge)
> **Source:** [GitHub](https://github.com/WeerasingheMSC/First_Exetention)

---

## The Problem It Solves

Every Node.js project starts the same way:

1. `npm init`
2. Install `express`, `mongoose`/`mysql2`/`pg`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `cors`...
3. Create `models/`, `controllers/`, `routes/`, `middleware/`, `config/` folders
4. Wire up the DB connection
5. Write a User model, hash passwords, generate JWT tokens
6. Register routes in `server.js`
7. ...and *then* start building your actual feature

That's 30–60 minutes of zero-value work on every new project. **NodeForge eliminates all of it.**

---

## Key Features

### 🗄️ Multi-Database Support
Choose your database at generation time — NodeForge writes the right driver code for all three:
- **MongoDB** (Mongoose)
- **MySQL** (mysql2)
- **PostgreSQL** (pg)

### 🔷 JavaScript + TypeScript
Full native support for both. TypeScript projects get the correct `@types/*` packages installed automatically.

### 🔐 One-Click JWT Authentication
Generates a complete auth layer:
- `User` model with `bcrypt` password hashing
- `register` / `login` / `getMe` controller
- JWT middleware for route protection
- `.env` with `JWT_SECRET`

### 🏗️ 3 Folder Architecture Presets
Not every project needs the same structure:

| Preset | Best For |
|---|---|
| **Simple** | Small APIs, prototypes |
| **Advanced** | Most real-world projects (`src/` layout) |
| **Clean Architecture** | Enterprise apps (Domain / Application / Infrastructure separation) |

### 🧠 Smart "Add Module" — The Best Feature
Already have a running project? The **Add** tab auto-detects your:
- Language (JS or TS)
- Installed database driver
- Existing folder structure

...then injects a new CRUD module *and* patches your `server.ts` / `server.js` so the new routes are live immediately. Zero config.

---

## What Gets Generated

Here's what a **Full Backend (TypeScript + MongoDB + Advanced layout)** produces:

```
├── src/
│   ├── config/
│   │   └── db.ts               ← Mongoose connection
│   ├── models/
│   │   ├── Product.ts          ← Your entity model
│   │   └── User.ts             ← Auth user model (bcrypt)
│   ├── controllers/
│   │   ├── product.controller.ts
│   │   └── auth.controller.ts  ← register / login / getMe
│   ├── routes/
│   │   ├── product.routes.ts
│   │   └── auth.routes.ts
│   ├── middleware/
│   │   └── auth.middleware.ts  ← JWT verification
│   └── utils/
├── server.ts                   ← Fully wired entry point
├── .env                        ← PORT, DB_URI, JWT_SECRET
└── tsconfig.json
```

All of that — from clicking **Generate** to running `npm run dev` — takes under 30 seconds.

---

## How to Use It

1. Install **NodeForge** from the VS Code Marketplace
2. Click the **NodeForge icon** in the Activity Bar (left sidebar)
3. Pick your mode: **Module**, **Auth**, **Full Backend**, or **Add**
4. Fill in your details (module name, fields like `name:string, price:number`, DB URI, port)
5. Hit **Generate**
6. Run `npm install && npm run dev` in the terminal — you're live ✅

![NodeForge Demo](https://raw.githubusercontent.com/WeerasingheMSC/First_Exetention/74376e2013acdb0b59acad6656abbfdba2081994/Untitled%20design%20(3).gif)

---

## NodeForge vs. Other Tools

| Feature | NodeForge | Basic snippet tools | Manual setup |
|---|---|---|---|
| Full project scaffold | ✅ | ❌ | ⏱️ 45+ min |
| JWT Auth generation | ✅ | ❌ | ⏱️ 20+ min |
| Multi-DB support | ✅ | ❌ | ⏱️ varies |
| JS + TypeScript | ✅ | Partial | ⏱️ varies |
| Auto-detects existing project | ✅ | ❌ | N/A |
| 3 architecture presets | ✅ | ❌ | N/A |
| Interactive sidebar UI | ✅ | ❌ | N/A |

---

## Requirements

- VS Code 1.75+
- Node.js 16+
- npm on your PATH

---

## What's Next

I'm actively working on NodeForge and plan to add:
- GraphQL support
- Docker + docker-compose file generation
- More database ORMs (Prisma, Sequelize)
- Custom template support

---

## Try It Out

If you're tired of re-writing the same boilerplate on every backend project, give NodeForge a shot.

👉 **[Install NodeForge on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SahanCW.node-forge)**

⭐ **[Star it on GitHub](https://github.com/WeerasingheMSC/First_Exetention)**

Any feedback, feature requests, or bug reports are very welcome — drop them in the GitHub issues or in the comments below!

---

*Built with TypeScript, powered by the VS Code Extension API.*
