# Course Grade Prediction

## How to run

Requires Python 3.12 and Node.js 22.12 or newer. Run these commands in PowerShell from the repository root.

### Install once

python refers to the Python interpreter installed on your computer.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
cd ..
```

### Start the backend

In the first terminal:

The backend listens on port 8000. Its API address is http://127.0.0.1:8000.

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### Start the frontend

In a second terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open http://127.0.0.1:5173.

Startup creates the database and demo data automatically. The default Admin login is `admin` / `12345678`, unless you configured a different password.

## Optional .env configuration

The app runs without a `.env` file. To customize configurations, copy `.env.example` to `.env` in the repository root if you do not already have one.

| Setting | What you can change | Default |
| --- | --- | --- |
| `DATABASE_PATH` | Database filename or location. Relative paths start inside `backend/`. | `app.db` |
| `FRONTEND_ORIGIN` | Frontend address allowed to access the backend. | `http://127.0.0.1:5173` |
| `JWT_SECRET` | Secret used to sign login tokens. Set a fixed value to keep logins valid across restarts until they expire. | Randomly generated at startup |
| `JWT_EXPIRY_MINUTES` | How many minutes a login token stays valid. Must be a positive whole number. | `60` |
| `INITIAL_ADMIN_PASSWORD` | Admin password to create or update on backend startup. Must be 8-128 characters. | `12345678` for a new Admin |

Keep `JWT_ALGORITHM=HS256`; it is the only supported algorithm.

After changing `.env`, stop the backend with Ctrl+C and run its startup command again. The password setting also updates an existing Admin account. If you never set this option, the default password stays `12345678`.
