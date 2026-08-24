# Kestrel — Sign Up / Log In Setup

This adds real account sign up and log in to the Kestrel site, backed by your
MongoDB Atlas cluster (`Cluster0`). Passwords are hashed with bcrypt before
they're ever stored — the database never sees a plain-text password.

## How it fits together

```
your browser  →  Express server (server/)  →  MongoDB Atlas (Cluster0)
               (serves the HTML + the /api/auth/* routes)
```

The HTML page can't talk to MongoDB directly — browsers can't do that safely
— so the `server/` folder is a small Node.js server that sits in between. It
serves the site *and* handles sign up / log in.

## 1. Install Node.js (if you don't have it)

Download the LTS version from [nodejs.org](https://nodejs.org) and install
it. To check if you already have it, open a terminal and run:

```
node -v
```

Anything v18 or newer works fine.

## 2. Allow your computer through Atlas's firewall

MongoDB Atlas blocks all connections by default until you explicitly allow
an IP address. This is the step people most often forget.

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and open your project.
2. In the left sidebar, click **Network Access**.
3. Click **Add IP Address**.
4. For local testing, the easiest option is **Allow Access from Anywhere**
   (`0.0.0.0/0`). It's fine for development; if you later deploy this
   publicly, tighten it to your server's actual IP.
5. Save, and wait ~1 minute for it to take effect.

## 3. Install dependencies

Open a terminal in the `server/` folder and run:

```
npm install
```

## 4. Check your `.env` file

`server/.env` is already filled in with your Atlas connection string and a
randomly generated login-session secret — you shouldn't need to touch it.
It's listed in `.gitignore`, so it will **not** get committed if you push
this project to GitHub. `.env.example` is the safe, secret-free version
that *is* meant to be committed.

```
MONGODB_URI=mongodb+srv://belttoassuniversity_db_user:...@cluster0.ltigbm6.mongodb.net/kestrel?appName=Cluster0
JWT_SECRET=<a long random string>
PORT=3000
```

> **One thing worth doing:** since the database password was typed into a
> chat at some point, it's good hygiene to rotate it in Atlas (Database
> Access → edit user → Edit Password) once everything's working, then just
> update the password in this `.env` file to match.

## 5. Run it

```
npm start
```

You should see:

```
✔ Connected to MongoDB Atlas
✔ Kestrel server running at http://localhost:3000
```

Open **http://localhost:3000** in your browser — that's the full site,
served by your new backend. Click **Log In** in the top right to open the
sign up / log in modal.

If you see a connection error instead, it's almost always the Network
Access step above (or a typo'd password).

## What you get

- **Sign Up** — creates an account (username, email, password). Usernames
  must be 3–24 characters (letters/numbers/underscores), passwords need to
  be at least 8 characters.
- **Log In** — accepts either username or email.
- Once logged in, the **Log In** button is replaced by your username and a
  logout button in the navbar, and the live chat shows your real username
  instead of "You" when you send a message.
- Logging in sets a secure, httpOnly cookie, so refreshing the page keeps
  you logged in for 7 days.
- Passwords are never stored in plain text — only a bcrypt hash.

## Where things live

```
website-project/
  kestrel-streaming-site.html   ← the site itself (now with the auth modal wired in)
  server/
    server.js                   ← starts everything
    db.js                       ← connects to MongoDB Atlas
    models/User.js               ← the user schema
    routes/auth.js               ← signup / login / logout / me endpoints
    middleware/requireAuth.js    ← reusable guard for future logged-in-only features
    .env                         ← your real credentials (not committed)
    .env.example                 ← safe template (committed)
```

## Checking your data in Atlas

Once someone signs up, you'll see it appear in Atlas under
**Cluster0 → Browse Collections → kestrel database → users collection**.
Each document looks like:

```json
{ "username": "...", "email": "...", "passwordHash": "$2a$10$...", "createdAt": "..." }
```

## If you want this live on the internet later

Right now this only runs on your own machine. To make it a real public
site you'd deploy the `server/` folder somewhere that can run Node.js
(Render, Railway, Fly.io, etc.), set the same three environment variables
there, and point Atlas's Network Access at that host instead of (or in
addition to) "anywhere." Happy to walk through that with you when you're
ready — just ask.
