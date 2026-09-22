# 📚 Bookshop — CAP + Fiori Elements on SAP BTP

> **A beginner's end-to-end guide.** This project is a complete bookstore application built with the
> **SAP Cloud Application Programming Model (CAP)** and **SAP Fiori Elements**, deployable to
> **SAP BTP (Cloud Foundry)** with an **SAP HANA Cloud** database.
>
> If you are new to SAP: read this file top to bottom. Every folder, every config file, every
> deployment step is explained with *what it is, why it exists, and how it is used*.

---

## Table of Contents

1. [Big Picture — What Is This Thing?](#1-big-picture--what-is-this-thing)
2. [Prerequisites — What You Need Installed / Created](#2-prerequisites--what-you-need-installed--created)
3. [Project Tour — Every Folder and File Explained](#3-project-tour--every-folder-and-file-explained)
4. [The Three Backend Services (OData APIs)](#4-the-three-backend-services-odata-apis)
5. [The Three Frontend Apps (What Users See)](#5-the-three-frontend-apps-what-users-see)
6. [Run It on Your Laptop (Local Development)](#6-run-it-on-your-laptop-local-development)
7. [Prepare SAP BTP (One-Time Cockpit Setup)](#7-prepare-sap-btp-one-time-cockpit-setup)
8. [Deploy to SAP BTP (Step by Step)](#8-deploy-to-sap-btp-step-by-step)
9. [Give Users Access (Roles)](#9-give-users-access-roles)
10. [Update / Redeploy / Undeploy](#10-update--redeploy--undeploy)
11. [Troubleshooting — When Something Goes Wrong](#11-troubleshooting--when-something-goes-wrong)
12. [Glossary — Words Beginners Always Ask About](#12-glossary--words-beginners-always-ask-about)
13. [Command Cheat Sheet](#13-command-cheat-sheet)

---

## 1. Big Picture — What Is This Thing?

### What the app does

A small bookstore system with three user views:

| Who     | App            | What they do there                              |
| ------- | -------------- | ----------------------------------------------- |
| Shopper | **Browse**     | Search books, see price/stock/rating, add reviews |
| Staff   | **Manage**     | Back-office: edit books, authors, orders        |
| Shopper | **Orders**     | Create an order, add items, submit / cancel it  |

### How the pieces fit together (memorize this drawing)

```text
  BROWSER (you)
     │  ① opens https://<approuter-url>/browse/...
     ▼
  ┌──────────────┐   ② "logged in?"    ┌──────────────┐
  │  APPROuter   │ ──────────────────▶ │    XSUAA     │
  │ (front door) │ ◀────────────────── │ (login/bouncer)│
  └──────┬───────┘   ③ token (ID card) └──────────────┘
         │  ④a page? ──▶ HTML5 REPO (file shelf with the 3 websites)
         │  ④b data (/odata/...)? ──▶ BACKEND (srv) ──▶ HANA DATABASE (tables)
         ▼
  Browser shows page / data
```

**One request, step by step:**

1. You open the approuter URL. The approuter is the *only* address users ever type.
2. Approuter asks XSUAA: "is this user logged in?" If not, you see the SAP login page.
3. After login, XSUAA gives the browser a signed **token** (like a stamped ID card).
4. For a *page* (`/browse/...`), the approuter fetches the website files from the **HTML5 Repository** and hands them over.
5. The page then calls `/odata/v4/catalog/bahi`. The approuter forwards that call **plus your token** to the **backend**.
6. The backend checks the token with XSUAA, reads/writes rows in **HANA**, and returns JSON. The approuter passes it back to the browser.

### Why so many pieces? (the honest beginner answer)

| Piece | Why can't we skip it? |
| ----- | --------------------- |
| Backend (`srv`) | Someone must enforce rules (price > 0, stock checks) and talk to the DB. Browsers must never touch the database directly. |
| Database (HANA) | Data must survive restarts. Memory alone forgets everything. |
| Approuter | Gives **one** URL, handles login centrally, and hides backend addresses from users. |
| XSUAA | Login, passwords, and permission checks done by SAP instead of code you write (and get wrong). |
| HTML5 Repo | A proper versioned "shelf" for website files, so UI and backend can be deployed/updated independently. |
| `mta.yaml` | One file that deploys all of the above **together in the right order** with one command. Without it you'd deploy 4 apps + 4 services by hand, in the right sequence, wiring URLs manually. |

---

## 2. Prerequisites — What You Need Installed / Created

### A. On your laptop

| Tool | Why | Check / install |
| ---- | --- | --------------- |
| Node.js 20+ (64-bit) | Runs the backend and build tools | `node --version` → need `^20 \|\| ^22 \|\| ^24`. Install from nodejs.org |
| `@sap/cds-dk` (global) | The `cds` command: run, build, compile | `npm i -g @sap/cds-dk` then `cds --version` |
| Cloud Foundry CLI (`cf`) | Talks to SAP BTP ("deploy this!") | `cf --version`. Install from github.com/cloudfoundry/cli |
| MBT (MTA Build Tool) | Packs `mta.yaml` into one `.mtar` parcel | `mbt --version`. Install: `npm i -g mbt` (needs Java 8+ on PATH) |
| VS Code + SAP CDS extension (optional, recommended) | Syntax highlighting, `cds watch` task | VS Code marketplace: "SAP CDS Language Support" |

### B. In SAP BTP (trial is enough)

1. A **SAP BTP trial/global account** (cockpit: `cockpit.hanatrial.ondemand.com`).
2. A **subaccount** with **Cloud Foundry environment enabled** (creates an org + space).
3. **Entitlements** (quota permissions) added to your subaccount — the deployment *fails* without these:

| Service | Plan | Why you need it |
| ------- | ---- | --------------- |
| `hana` | `hdi-shared` | The shared HANA database where your tables live. Cheap/free, perfect for learning. |
| `xsuaa` | `application` | The login/security service (1 instance). |
| `html5-apps-repo` | `app-host` | Shelf where website files are *stored* at deploy time. |
| `html5-apps-repo` | `app-runtime` | Permission to *read* those files at runtime. |

> Where: Cockpit → your subaccount → **Entitlements** → *Configure Entitlements* → *Add Service Plans* → add the four rows above → Save. (Trial accounts usually already include them; just verify.)

---

## 3. Project Tour — Every Folder and File Explained

```text
bookshop/
├── db/                  ← DATA LAYER: what data exists (tables) + sample rows
│   ├── schema.cds       ← the tables: Books, Authors, Genres, Reviews, Customers, Orders, OrderItems
│   └── data/*.csv       ← starter data loaded into those tables (authors, books, ...)
├── srv/                 ← BACKEND: the 3 OData services + their logic
│   ├── catalog-service.cds / .js   ← public storefront API + stock/price/review logic
│   ├── admin-service.cds / .js     ← staff back-office API + housekeeping actions
│   └── orders-service.cds / .js    ← ordering flow API (create → add items → submit/cancel/ship)
├── app/                 ← FRONTEND: websites users open in the browser
│   ├── fiori-annotations.cds  ← tells Fiori HOW to display data (columns, forms, facets)
│   ├── index.html             ← landing page with 3 cards (Browse / Manage / Orders)
│   ├── browse/webapp/   ← storefront UI on CatalogService (manifest, Component, index, i18n)
│   ├── admin/webapp/    ← back-office UI on AdminService
│   └── orders/webapp/   ← ordering UI on OrdersService
├── approuter/           ← FRONT DOOR: login check + forwards traffic
│   ├── package.json     ← installs/starts the standard SAP approuter
│   └── xs-app.json      ← traffic rules: which URL goes to backend vs. to web pages
├── xs-security.json     ← LOGIN RULEBOOK: permissions (scopes) + roles handed to people
├── mta.yaml             ← DEPLOYMENT RECIPE: 4 apps + 4 services, wired together
├── package.json         ← Node project file: libraries, npm scripts, CAP profiles
└── gen/                 ← BUILD OUTPUT (auto-generated, git-ignored, never edit by hand)
```

### 3.1 `db/` — the data layer ("what tables exist")

- **`db/schema.cds`** — declares 7 entities in namespace `sap.capire.bookshop`:
  `Genres`, `Authors`, `Books` (with `price`, `stock`, `rating`, localized `title`/`descr`),
  `Reviews`, `Customers`, `Orders` (with `status`: Open/Submitted/Shipped/Cancelled),
  `OrderItems`. It uses reusable building blocks: `cuid` (auto-ID), `managed` (auto
  createdAt/By, modifiedAt/By), and a custom `Addressable` aspect (street/city/country).
- **`db/data/*.csv`** — sample rows (one CSV per table) that are loaded automatically on
  `cds deploy` (locally) and by the db-deployer (on HANA). This is why the app has books
  immediately after setup — no manual data entry needed.

### 3.2 `srv/` — the backend ("what the app can DO")

Each service = a `.cds` file (the *contract*: entities, actions, functions = what URLs exist)
plus a `.js` file (the *logic*: validation, calculations = what happens when called).
See [section 4](#4-the-three-backend-services-odata-apis) for the full endpoint list.

### 3.3 `app/` — the frontend ("what users SEE")

- **`app/fiori-annotations.cds`** — UI annotations (`@UI.LineItem` = table columns,
  `@UI.FieldGroup` = object-page form, `@UI.Facets` = tabs, `@UI.HeaderInfo` = page title,
  `@Common.ValueList` = dropdowns for author/genre). Without this file Fiori Elements would
  not know *which* fields to show — you'd get an empty page. It is compiled into the
  OData `$metadata`, so no UI code changes are needed to change the layout.
- **`app/index.html`** — plain landing page with 3 cards linking to the 3 apps.
  Set as the approuter's `welcomeFile`, so it's the first thing users see.
- **`app/<browse|admin|orders>/webapp/`** — one Fiori Elements app per service. Four files each:

  | File | Purpose — why it exists |
  | ---- | ----------------------- |
  | `manifest.json` | The app's ID card: which OData service + entity it shows (`CatalogService.bahi` etc.), ListReport + ObjectPage routing. **Most important UI file.** |
  | `Component.js` | 6-line starter that boots the standard Fiori Elements component. You never change it unless adding custom extensions. |
  | `index.html` | Loads SAPUI5 from CDN and starts the component. Used for local testing via `cds watch`. |
  | `i18n/i18n.properties` | App title + description (translatable texts). |

### 3.4 `approuter/` — the front door ("one URL + login")

- **`approuter/xs-app.json`** — traffic rules, checked **top to bottom, first match wins**:
  1. `^/odata/(.*)$` → forward to destination `srv-api` (the backend), **with login** + user token.
  2. `^/(.*)$` → fetch from destination `html5-apps-repo-rt` (the web pages), **with login**.
  
  > Beginner trap: order matters. The catch-all `/(.*)` must stay **last**, otherwise data
  > calls would be treated as page requests.
- **`approuter/package.json`** — only installs (`@sap/approuter`) and starts the standard SAP
  router. All behavior comes from `xs-app.json`, not from code.

#### Approuter + `xs-app.json` deep dive — where they run and how they connect

**Where does the approuter live and run?**

| Question | Answer |
| -------- | ------ |
| Folder in this repo | `approuter/` (2 files only: `package.json`, `xs-app.json`) |
| Running where? | As the `bookshop-approuter` module on Cloud Foundry (Node.js app, 1 instance, 256 MB). See `mta.yaml` Module 4. |
| Its URL | `https://bookshop-approuter-<space>.<region>.hana.ondemand.com` — find it via `cf app bookshop-approuter` (the `routes:` line). **This is the only URL users ever type.** The backend (`bookshop-srv`) and the file shelf are never opened directly. |
| Local laptop? | **Not used locally.** `cds watch` serves backend + UIs directly with mock login. `xs-app.json` takes effect only in the cloud. (Experts can run it locally with a `default-env.json`, but you don't need that.) |

**How the two files relate (one sentence):** `package.json` only *starts* the standard SAP
router engine; `xs-app.json` is the *instruction sheet* that engine reads at startup —
every routing decision comes from there, there is no custom code.

**Startup sequence (what happens when the app boots in Cloud Foundry):**

```text
1. CF runs:  node node_modules/@sap/approuter/approuter.js   (from package.json "start")
2. Approuter reads xs-app.json  -> learns welcomeFile + routes + logout
3. Approuter reads its ENVIRONMENT (VCAP_SERVICES + DESTINATIONS), which cf deploy
   filled in from mta.yaml "requires":
     - group "xsuaa"        -> login server address + our client id/secret
                              (from the bookshop-auth service instance)
     - destination "srv-api"            -> backend URL (offered by bookshop-srv)
     - destination "html5-apps-repo-rt" -> file-shelf URL (offered by bookshop-html5-rt)
4. Approuter is ready: it listens on its public URL and applies the routes below.
```

> Key insight for beginners: `xs-app.json` says **"forward to destination `srv-api`"**,
> and `mta.yaml` (Module 4 → `requires` → `group: destinations` → `properties.name: srv-api`)
> is what **creates** that destination and fills in its real URL. If the nickname in
> `xs-app.json` (`"destination": "srv-api"`) and the `name:` in `mta.yaml` don't match
> exactly, forwarding breaks. Same for `html5-apps-repo-rt`.

**`xs-app.json` field by field (your actual file):**

| Field | What it does, in plain words |
| ----- | ---------------------------- |
| `welcomeFile: "/app/index.html"` | Opening just `/` shows the landing page (the 3 cards). |
| `authenticationMethod: "route"` | "Decide login separately for each route, using that route's `authenticationType`." (Alternative `all` would lock the whole site with one rule.) |
| `logout.logoutEndpoint: "/do/logout"` | Visiting `<approuter-url>/do/logout` destroys the login session. Link this from your UI's logout button. |
| Route 1 `source: "^/odata/(.*)$"` | A **regex**. `^...$` = must match the whole path; `(.*)` = capture everything after `/odata/` into variable `$1`. Matches `/odata/v4/catalog/bahi` etc. |
| Route 1 `target: "/odata/$1"` | Rebuild the path sent to the backend (`/odata/` + captured part). So the backend receives the same OData path it knows. |
| Route 1 `destination: "srv-api"` | Look up nickname `srv-api` in the address book (created by `mta.yaml`) and send the request there. |
| Route 1 `authenticationType: "xsuaa"` | Must be logged in via XSUAA; the approuter attaches your login **token** to the forwarded call (`forwardAuthToken: true` in `mta.yaml`). |
| Route 2 `source: "^/(.*)$"` | Catch-all: matches **everything else** (pages, images, `/browse/...`, `/app/...`). |
| Route 2 `destination: "html5-apps-repo-rt"` | Fetch the file from the HTML5 shelf and return it to the browser. |

> ⚠️ **Golden rule: routes are checked top to bottom, first match wins.** The catch-all
> `^/(.*)$` must stay **last** — if you put it first, `/odata/...` calls would be treated
> as page requests and data would stop working.

**One real request, traced end to end** — browser asks for
`GET https://<approuter>/odata/v4/catalog/bahi?$top=5`:

```text
① Browser → approuter : GET /odata/v4/catalog/bahi?$top=5  (+ login cookie)
② Approuter           : cookie valid? No → redirect to XSUAA login page. Yes → step ③.
③ Route matching      : Route 1 regex matches → destination "srv-api",
                        target becomes /odata/v4/catalog/bahi?$top=5
④ Approuter → backend : same path + headers, PLUS "Authorization: Bearer <your JWT>"
                        (your login token, because forwardAuthToken: true)
⑤ Backend (srv)       : validates the token with XSUAA, checks scopes from
                        xs-security.json, runs the CDS handler, reads HANA table
                        CatalogService_bahi, returns JSON [...]
⑥ Approuter → browser : passes the JSON back untouched. (It never modifies data;
                        it only checks login + forwards.)
```

A page request works the same way, except step ④ goes to the HTML5 shelf
(destination `html5-apps-repo-rt`) and returns `index.html`/JS files instead of JSON.

**How XSUAA plugs in (approuter ↔ `xs-security.json` link):**
`xs-app.json` never names scopes or roles — it only says `authenticationType: "xsuaa"`.
The *meaning* of the login (which scopes exist, which roles bundle them) comes from
`xs-security.json`, baked into the `bookshop-auth` service instance at deploy time, and
reaches the approuter through the `group: xsuaa` binding in `mta.yaml`. So:
`xs-security.json` defines the permissions → XSUAA enforces login → approuter demands login
per route → backend checks the token's scopes. Three files, one chain.

### 3.5 `xs-security.json` — the login rulebook ("who may do what")

Read **once at deploy time** to configure XSUAA:

| Key | Meaning for beginners |
| --- | --------------------- |
| `xsappname` | Your app's unique name in the login system; every permission is prefixed with it. |
| `tenant-mode: dedicated` | This app has its own user list. |
| `scopes` (`User`, `Admin`) | Permissions that *exist*. Scope = "something someone MAY do". |
| `role-templates` | Badges you hand to **real people** in the cockpit. `User` badge = User scope; `Admin` badge = both. You always assign *roles* to people, never raw scopes. |
| `oauth2-configuration.redirect-uris` | After login, SAP may only return users to your BTP addresses (anti-phishing rule). |

#### `xs-security.json` deep dive — the login rulebook, line by line

**First, what is XSUAA? (the 30-second version)**
XSUAA = SAP's **bouncer + ID-card maker**. Your app never sees passwords. When a user arrives,
the approuter sends them to SAP's login page; after a successful login XSUAA hands the browser
a signed **token (JWT)** — a tamper-proof ID card saying *"this is priya@example.com, she has
permissions X and Y"*. Every later request carries that card, and your backend just checks the
card instead of doing login itself. `xs-security.json` is the rulebook XSUAA is configured with.

**Where the file lives and WHEN it is used (this confuses every beginner):**

```text
YOUR LAPTOP                          SAP BTP (cloud)
───────────                          ─────────────────
xs-security.json
      │  mbt build → packed into the .mtar parcel
      ▼
cf deploy reads mta.yaml
      │  resource "bookshop-auth":  path: xs-security.json
      ▼
BTP creates ONE xsuaa service instance ("bookshop-auth") using your rulebook:
  - registers xsappname "bookshop-<space>"
  - creates scopes  bookshop-<space>.User , bookshop-<space>.Admin
  - creates role templates "User" and "Admin" (visible in cockpit → Security → Roles)
      │  binds credentials into bookshop-srv + bookshop-approuter
      ▼
RUNTIME (every request): approuter redirects to login → XSUAA issues token →
backend validates token. The file itself is NEVER read at runtime — it did its job
once, at deploy time. Change the file = redeploy to apply.
```

**Field by field (your actual file):**

| Field | Beginner meaning + how it's used |
| ----- | -------------------------------- |
| `xsappname: "bookshop"` | Your app's unique name in the login system. Note `mta.yaml` overrides it to `bookshop-${space}` (adds the CF space name so two spaces never collide). Every scope below is automatically prefixed with it: the real permission in tokens is `bookshop-myspace.User`, not just `User`. |
| `tenant-mode: "dedicated"` | "This app keeps its own user list." (Alternative `shared` = one login shared across tenants — only for SaaS/multitenant apps. You want `dedicated`.) |
| `description` | Free text shown in the cockpit. Nothing technical. |
| `scopes: [{name: "User"...}, {name: "Admin"...}]` | The **permissions that exist** — nothing more. Declaring a scope does NOT give it to anyone and does NOT lock any endpoint by itself. Scope = *"something someone MAY do"*. Think of scopes as keys cut at a locksmith: they exist, but nobody can open doors until you hand them out. |
| `attributes: []` | Extra user facts (e.g. `Department`, `Country`) for advanced attribute-based rules. Empty here = not used. Beginners can ignore it until they need row-level filtering like "managers see only their country's orders". |
| `role-templates` | **Badges you hand to real people.** Each template bundles scopes via `scope-references`. `$XSAPPNAME` is a placeholder auto-replaced with your xsappname, so `"$XSAPPNAME.User"` becomes `"bookshop-myspace.User"`. Your file: badge `User` carries scope `User`; badge `Admin` carries `User` **+** `Admin` (admins can also do everything users can). After deploy these appear in cockpit → Security → Roles under your application name. |
| `oauth2-configuration.redirect-uris` | Anti-phishing rule: after login SAP returns the user ONLY to these addresses. The wildcards (`https://*.cfapps.*.hana.ondemand.com/**`) cover all Cloud Foundry app URLs in your landscape. If users get an endless login loop, this list not covering your domain is suspect #1. |

**The vocabulary chain (memorize this — it answers 90% of auth confusion):**

```text
SCOPE (in this file)  →  what MAY be done        ("User", "Admin")
ROLE TEMPLATE (in this file) → badge bundling scopes  ("Admin" badge = User+Admin scopes)
ROLE (in cockpit, auto-created from template) → the actual badge object
ROLE COLLECTION (YOU create in cockpit) → bag holding one or more roles
USER (a person) → gets role collections assigned → token contains the scopes
```

> ⚠️ You **never** assign scopes directly to people — cockpit doesn't even offer that.
> People ← role collections ← roles ← scopes. Skip a level and access breaks.

**What a login token looks like (decoded, simplified):**
After Priya logs in and you gave her the Admin collection, her token payload contains:

```json
{
  "client_id": "sb-bookshop-dev!t42",
  "user_name": "priya@example.com",
  "scope": ["bookshop-dev.User", "bookshop-dev.Admin", "openid"],
  "xs.system.attributes": { "xs.rolecollections": ["Bookshop-Admin"] }
}
```

The backend reads `scope` and decides: allowed or `403 Forbidden`.

**One honest note about THIS project:** right now the scopes exist and the approuter forces
*login* on every route — but the CDS services don't yet lock individual entities to a scope.
That means any logged-in user can call everything. To truly restrict, e.g., the back-office,
add one line over the service in `srv/admin-service.cds`:

```cds
@requires: 'Admin'
service AdminService { ... }
```

and redeploy. Then a `User`-only token calling `/odata/v4/admin/...` gets `403`, while
`CatalogService` stays open to every logged-in user. This is the standard next step once
you're comfortable with the basics above.

**How to add a NEW permission later (e.g. `Manager`), step by step:**

1. `xs-security.json` → add `{ "name": "Manager", ... }` to `scopes`.
2. Add it to a role template's `scope-references` (or add a new template).
3. Redeploy (`mbt build` + `cf deploy ...`) so XSUAA learns the new scope.
4. Cockpit → Role Collections → add the role to the right collection.
5. Affected users **log out and back in** (old tokens don't magically gain the new scope).

### 3.6 `mta.yaml` — the deployment recipe ("deploy everything with 1 command")

- **Modules (4)** = running apps, each gets its own URL in Cloud Foundry:
  1. `bookshop-srv` (backend, code from `gen/srv`; *needs* DB + login; *offers* its URL as `srv-api`).
  2. `bookshop-db-deployer` (runs once: creates tables + loads CSVs, then stops — users never open it).
  3. `bookshop-app-content` (uploads `app/` website files to the HTML5 shelf — not a server, just stored files).
  4. `bookshop-approuter` (the front door; *needs* backend URL + login + shelf-read permission).
- **Resources (4)** = helper services BTP creates for you:
  `bookshop-db` (HANA `hdi-shared` container), `bookshop-auth` (XSUAA from `xs-security.json`),
  `bookshop-html5-host` (shelf *storage*), `bookshop-html5-rt` (shelf *reading*).
- **`provides` / `requires`** = the wiring. `provides` = "I offer my URL under this nickname";
  `requires` = "I need that nickname's URL". BTP plugs them together at deploy time, so no
  hardcoded URLs exist anywhere. (`~{srv-url}` means "copy the value the other module offered".)
- **`build-parameters.before-all`** = runs `npm ci` + `cds build --production` once before
  packing, producing the `gen/` folder the modules point to.
- heavily commented in the file itself — open it and read the `#` comments.

### 3.7 `package.json` — the Node project file

| Part | Why it matters |
| ---- | -------------- |
| `dependencies` (`@sap/cds`, `@cap-js/hana`, `@cap-js/sqlite`, `@sap/xssec`, `express`) | Libraries the backend needs at runtime. |
| `scripts` | Shortcuts: `watch` (local dev), `build` (production build), `deploy`/`undeploy` (HANA shortcuts). |
| `cds.requires` | **Profiles**: locally (`db.kind: sql` = SQLite file) vs. production (`hana` + `xsuaa` login). Same code, different backends — switched automatically. |
| `cds.build.tasks` | What `cds build` produces: `hana` (DB artifacts from `db/`), `node-cf` (backend from `srv/`), `fiori` (UI from `app/`). |
| `sapux` | Lists the 3 UI apps so SAP tooling recognizes them as HTML5 content. |
| `engines` | Node `^20 \|\| ^22 \|\| ^24` — also tells Cloud Foundry which Node to run. |

### 3.8 `gen/` — build output (auto-generated, never edit)

Created by `cds build --production` (and by `mbt build` via `mta.yaml`'s `before-all`).
Contains `gen/srv` (backend the cloud runs) and `gen/db` (`.hdbtable`/`.hdbview`/`.hdbtabledata`
files the db-deployer executes). It is **git-ignored** — always rebuilt, never committed.
If it looks strange: delete it and rebuild; it's disposable.

---

## 4. The Three Backend Services (OData APIs)

Base URLs (local; on BTP everything is prefixed with the approuter URL, paths stay the same):

| Service | Local base URL | Purpose |
| ------- | -------------- | ------- |
| CatalogService | `/odata/v4/catalog/` | Public storefront |
| AdminService | `/odata/v4/admin/` | Staff back-office |
| OrdersService | `/odata/v4/orders/` | Ordering flow |

### CatalogService — entities, actions, functions

- **Entities:** `bahi` (= Books), `lekhaka` (= Authors), `Genres`, `Reviews`, `Customers`, `Orders`, plus `expensive_books` and functions `mostExpensive()` / `cheapest()`.
- **Bound actions** (called on ONE book, e.g. `POST .../bahi(<ID>)/addStock` with `{"amount": 5}`):
  `addStock`, `removeStock`, `applyDiscount(percent)`, `setPrice(newPrice)`, `rateBook(rating)`,
  `addReview(reviewer, rating, title, comment)` (also recalculates the book's cached rating).
- **Unbound actions** (called on the service root, e.g. `POST .../catalog/restockLowStock`):
  `resetAllStock`, `restockLowStock(threshold, amount)`, `discountByGenre`, `discountByAuthor`,
  `recalculateRatings`, `placeOrder(customerID, bookID, quantity)` (creates Order + OrderItem + reduces stock), `deleteOutOfStock`.
- **Functions** (called with GET): `totalStock`, `averagePrice`, `countOutOfStock`, `inventoryValue`,
  `bookRating(bookID)`, `genreStats`, `authorStats(authorID)`, `booksByPriceRange(min,max)`,
  `searchBooks(query)`, `booksByAuthor`, `booksByGenre`, `topRated(limit)`, `newReleases(limit)`,
  `lowStockBooks(threshold)`, `getReviews(bookID)`, `customersByCountry(country)`.
- **Safety rules** (in `catalog-service.js`): price > 0, stock never negative, ratings in range;
  `removeStock`/`placeOrder` refuse when stock is insufficient.

### AdminService — entities, actions, functions

- **Entities:** `Books`, `Authors`, `Genres`, `Reviews`, `Customers`, `Orders`, `OrderItems` (full CRUD).
- **Actions:** `bulkUpdatePrices(percent)`, `recalculateOrderTotals`, `archiveZeroStockBooks`,
  `adjustLoyalty(customerID, points)`, `setOrderStatus(orderID, status)`, `deleteReview(reviewID)`.
- **Functions:** `orderStats` (count + total per status), `topCustomers(limit)`, `reviewsForModeration(minRating)`.

### OrdersService — entities, actions, functions

- **Entities:** `Orders` (+ bound actions below), `OrderItems`, `Customers`, readonly `BookList` (ID, title, price, stock, rating, author, genre).
- **Bound order actions:** `submit` (Open → Submitted), `cancel`, `ship`, `addItem(bookID, quantity)`, `removeItem(itemID)`.
- **Unbound actions:** `createOrder(customerID)`, `checkout(orderID)`.
- **Functions:** `orderTotal(orderID)`, `ordersByCustomer(customerID)`, `openOrders()`.

> Try them with the ready-made requests in `test.http` (VS Code REST Client) or with
> `cds watch` + the `$metadata` URLs from the next section.

---

## 5. The Three Frontend Apps (What Users See)

| App | Folder | Shows (service → entity) | Page type |
| --- | ------ | ------------------------ | --------- |
| Browse Books | `app/browse/webapp` | CatalogService → `bahi` | ListReport (table) → ObjectPage (details + Reviews tab) |
| Manage Books | `app/admin/webapp` | AdminService → `Books` | ListReport → ObjectPage (details + Reviews tab) |
| Orders | `app/orders/webapp` | OrdersService → `Orders` | ListReport → ObjectPage (details + Items tab) |

All three are **Fiori Elements** apps: almost no UI code — the layout comes from
`app/fiori-annotations.cds` (`@UI.LineItem` = columns, `@UI.FieldGroup` = form,
`@UI.Facets` = tabs like *Reviews/Items*, `@Common.ValueList` = author/genre dropdowns).
To change what users see, you usually edit **annotations**, not JavaScript.

---

## 6. Run It on Your Laptop (Local Development)

**Why local first?** SQLite + mock login = zero cloud cost, instant restart, full debugging.
Only deploy to BTP when it works here.

```bash
# 1. Install libraries (once)
npm install

# 2. Start backend + SQLite DB + live reload (keep running)
npm run watch          # = cds watch
# first start creates the SQLite file and loads db/data/*.csv automatically

# 3. Open in browser (cds watch prints the URLs; defaults):
#    Backend root:            http://localhost:4004
#    Catalog metadata:        http://localhost:4004/odata/v4/catalog/$metadata
#    Admin metadata:          http://localhost:4004/odata/v4/admin/$metadata
#    Orders metadata:         http://localhost:4004/odata/v4/orders/$metadata
#    Books data (JSON):       http://localhost:4004/odata/v4/catalog/bahi
#    Fiori preview (Browse):  http://localhost:4004/browse/webapp/index.html
#    Fiori preview (Manage):  http://localhost:4004/admin/webapp/index.html
#    Fiori preview (Orders):  http://localhost:4004/orders/webapp/index.html
```

Other handy commands:

```bash
npm run watch-fiori   # watch + opens the Browse UI directly
npm run build         # production build -> gen/ (same as deploy uses)
npx cds compile srv --to edmx   # inspect the OData contract without starting the server
```

- **Test the actions** with `test.http` (install the VS Code "REST Client" extension, click *Send Request* above any request).
- **Change code?** Just save — `cds watch` recompiles and the browser refreshes.
- **Reset local data?** Stop the server, delete the `*.sqlite`/`*.db` file in the project root, restart.

---

## 7. Prepare SAP BTP (One-Time Cockpit Setup)

Do this **once** before your first deployment. (~15 minutes)

### Step 1 — Subaccount + Cloud Foundry space

1. Open the cockpit (`cockpit.hanatrial.ondemand.com` for trial).
2. Go to your **subaccount** (create one if needed).
3. **Enable Cloud Foundry**: *Overview → Enable Cloud Foundry* → pick a plan → *Create*.
   This gives you an **Org** and a **Space** (note both names — the deploy commands need them).
4. Add the 4 **entitlements** from [section 2B](#b-in-sap-btp-trial-is-enough)
   (*Entitlements → Configure Entitlements → Add Service Plans*).

### Step 2 — What to create manually vs. what the deployer creates

| Thing | Who creates it | How |
| ----- | -------------- | --- |
| Org / Space | You (Step 1) | Cockpit |
| Entitlements | You (Step 1) | Cockpit |
| HDI container, XSUAA instance, HTML5 host+runtime, all 4 apps | `cf deploy` reads `mta.yaml` and creates **everything** | automatic |
| Role Collection + user assignment | You ([section 9](#9-give-users-access-roles)) | Cockpit (after deploy) |

> You do **NOT** pre-create service instances for the database, xsuaa, or html5-repo —
> the MTA deployer creates and binds them from `mta.yaml`. Creating them by hand causes
> name clashes. The only manual security step is assigning *roles to people* afterwards.

---

## 8. Deploy to SAP BTP (Step by Step)

Run from this project folder. Three commands do the whole job:

```bash
# STEP 1 — PACK: build the .mtar parcel (runs npm ci + cds build, then packs all modules)
mbt build
# result: mta_archives/bookshop_1.0.0.mtar   (one file containing all 4 apps + services)

# STEP 2 — CONNECT: log in and select where to deploy
cf login -a https://api.cf.<region>.hana.ondemand.com
#   (trial: the API endpoint is shown in cockpit → subaccount → Overview → Cloud Foundry)
cf target -o <YOUR-ORG> -s <YOUR-SPACE>

# STEP 3 — SHIP: upload + create services + start apps (takes several minutes)
cf deploy mta_archives/bookshop_1.0.0.mtar
```

**What happens during `cf deploy`** (so the log output makes sense):

1. Creates resources: HDI container → XSUAA instance (from `xs-security.json`) → HTML5 host + runtime.
2. Starts `bookshop-db-deployer` → creates tables/views, loads CSV data → stops (its job is done).
3. Starts `bookshop-srv` (backend) and binds DB + XSUAA credentials into its environment.
4. Uploads `app/` files via `bookshop-app-content` into the HTML5 host.
5. Starts `bookshop-approuter` with the `srv-api` + `html5-apps-repo-rt` destinations.

**Check it worked:**

```bash
cf apps
# bookshop-srv, bookshop-approuter running (db-deployer shows "stopped" — that is CORRECT)

cf app bookshop-approuter        # copy the "routes:" URL — that is YOUR app address
# open in browser:
#   <approuter-url>/app/index.html          landing page (welcomeFile)
#   <approuter-url>/browse/webapp/index.html
#   <approuter-url>/admin/webapp/index.html
#   <approuter-url>/orders/webapp/index.html
#   <approuter-url>/odata/v4/catalog/bahi   raw data (after login)
```

> First visit redirects you to the SAP login — that means XSUAA works. Log in, then
> continue with [section 9](#9-give-users-access-roles), otherwise you'll get `403 Forbidden`
> (logged in, but no role yet — see troubleshooting).

---

## 9. Give Users Access (Roles)

Deploying creates the *roles*, but **no person has them yet**. Until you do this section,
everyone gets `403 Forbidden`.

1. Cockpit → subaccount → **Security → Role Collections** → *New Role Collection*,
   e.g. `Bookshop-Admin`.
2. Open it → under *Role Name* select the `bookshop-auth` application →
   add the **`Admin`** role template → Save. (Repeat with a `Bookshop-User` collection + `User` template for shoppers.)
3. **Trust Configuration / Users**: assign the collection to your user
   (trial: your own user; productive: user groups from your identity provider).
4. Log out and back in at the approuter URL (or open it in a private window) so the new
   token contains the roles. The UIs should now load data.

> Beginner rule of thumb: **scopes** live in code/config (`xs-security.json`);
> **roles** bundle scopes; **role collections** are assigned to **people** in the cockpit.

---

## 10. Update / Redeploy / Undeploy

```bash
# After ANY code change: rebuild + redeploy (blue-green: old version keeps running until new is healthy)
mbt build
cf deploy mta_archives/bookshop_1.0.0.mtar
# tip: bump "version:" in mta.yaml (e.g. 1.0.1) per release so archives don't overwrite each other

# Watch live logs while testing
cf logs bookshop-srv --recent
cf logs bookshop-approuter --recent

# Remove EVERYTHING (apps + services + database!) — irreversible
cf undeploy bookshop --delete-services
```

Local DB shortcut (SQLite only, no Cloud Foundry involved):

```bash
npm run deploy     # cds deploy --to hana  (same deployer tech, HANA target)
npm run undeploy   # remove HANA artifacts again
```

---

## 11. Troubleshooting — When Something Goes Wrong

| Symptom | Most likely cause | Fix |
| ------- | ----------------- | --- |
| `mbt build` fails ("java not found") | MBT needs Java | Install Java 8+ and put it on PATH, retry. |
| `cf deploy` fails on `bookshop-db` | Missing `hana / hdi-shared` entitlement | [Section 2B](#b-in-sap-btp-trial-is-enough): add entitlement, redeploy. |
| `cf deploy` fails on `bookshop-auth` | Missing `xsuaa / application` entitlement, or invalid `xs-security.json` | Add entitlement; validate JSON parses (`node -e "JSON.parse(require('fs').readFileSync('xs-security.json'))"`). |
| `cf deploy` fails on html5 modules | Missing `html5-apps-repo` plans | Add `app-host` + `app-runtime` entitlements. |
| Browser: login loops forever | `redirect-uris` doesn't cover your landscape | Check `oauth2-configuration.redirect-uris` in `xs-security.json` matches your region's domain. |
| `401 Unauthorized` on `/odata/...` | Not logged in / token expired | Open the approuter URL (not the `srv` URL directly) and log in; direct backend URLs have no login session. |
| `403 Forbidden` after login | Logged in but **no role assigned** | Do [section 9](#9-give-users-access-roles); then re-login (private window). |
| Approuter shows `404` for `/browse/...` | HTML5 content missing or route order wrong | `cf apps` → is `bookshop-app-content` deployed? Is the catch-all route **last** in `xs-app.json`? |
| Fiori page loads but table is empty | Annotations didn't compile into `$metadata` | Open `/odata/v4/catalog/$metadata` — search for `UI.LineItem`. If absent: `cds build` errors? `app/fiori-annotations.cds` has a syntax error — fix, rebuild, redeploy. |
| `cds watch` shows no data | SQLite file stale/deleted | Restart `cds watch` (recreates + reloads CSVs). Never delete `db/data/*.csv`. |
| `bookshop-db-deployer` shows "stopped" | — | **Normal.** It runs once per deployment and stops. Only worry if it shows *failed*. |
| Port 4004 busy locally | Old `cds watch` still running | Kill the old terminal process, restart. |

---

## 12. Glossary — Words Beginners Always Ask About

| Word | One-sentence meaning |
| ---- | -------------------- |
| CAP / CDS | SAP's framework/language for defining data + services once and running them anywhere. |
| OData V4 | Standard web format for business data (`/Entity`, `/$metadata`, query with `$filter`, `$top`…). What the backend speaks. |
| Fiori Elements | SAP UI that builds itself from *annotations* — you describe *what* to show, not *how*. |
| MTA / `mta.yaml` / `.mtar` | **M**ulti-**T**arget **A**pplication: the recipe (`yaml`) packed into one parcel (`.mtar`) deploying apps + services together. |
| Cloud Foundry (CF) | The BTP runtime: takes your code, runs it, gives it a URL. `cf` CLI commands control it. |
| HDI container | Your private corner of a shared HANA database (tables, views, data). |
| XSUAA | SAP's login/token service: login page, signed ID-card tokens, scope checks. |
| Scope / Role / Role Collection | Scope = one permission; Role = bundle of scopes (in code); Role Collection = roles handed to people (in cockpit). |
| Approuter | Single front door: login check + serves pages + forwards data calls with your token. |
| HTML5 Repo (host vs runtime) | The file shelf: `app-host` = *storing* pages at deploy; `app-runtime` = *reading* them while running. |
| Destinations | The approuter's address book: nicknames (`srv-api`, `html5-apps-repo-rt`) → real URLs, filled at deploy. |
| `gen/` | Disposable build output (`gen/srv` runs in cloud, `gen/db` creates tables). Rebuilt every time. |
| `cds watch` / `cds build` | `watch` = local dev server with live reload; `build --production` = compile for cloud into `gen/`. |

---

## 13. Command Cheat Sheet

```bash
# --- local development ---
npm install            # install libraries (once)
npm run watch          # dev server + SQLite + live reload
npm run watch-fiori    # dev server + open Browse UI
npm run build          # production build -> gen/

# --- cloud deployment ---
mbt build                                    # pack -> mta_archives/bookshop_1.0.0.mtar
cf login -a https://api.cf.<region>.hana.ondemand.com
cf target -o <ORG> -s <SPACE>
cf deploy mta_archives/bookshop_1.0.0.mtar   # deploy everything
cf apps                                      # status + URLs
cf logs bookshop-srv --recent                # backend logs
cf logs bookshop-approuter --recent          # router logs
cf undeploy bookshop --delete-services       # delete EVERYTHING (careful!)
```

Happy learning! 🎓 Start local (`npm run watch`), break things, read the errors —
then ship to BTP with the three deploy commands.
