# Lineup Lab

A full-stack NBA lineup analytics dashboard. Aggregates possession-level data to surface lineup performance, player impact, and matchup insights across every combination of players on the floor.

**Live:** [frontend-production-c64c.up.railway.app](https://frontend-production-c64c.up.railway.app)

---

## Stack

- **Backend:** Python 3.13, Django 5.2, Django REST Framework 3.16, PostgreSQL 16
- **Frontend:** Angular 21.2, Angular Material/CDK 21.2, TypeScript, d3
- **Fonts:** Archivo Variable, IBM Plex Mono
- **Infrastructure:** Railway (backend + frontend + Postgres), Gunicorn, Whitenoise

---

## Features

- **Lineup Explorer** — filter by team, opponent, players, period, date range, lineup size (1–5 man); sort by any metric; URL-synced filters
- **Leader Section** — scroll-driven reveal of the top adjusted net rating lineup
- **Top Ten Rail** — best lineups by adjusted net rating with sparkline stats
- **Rating Map** — offensive vs defensive rating scatter plot across all lineups
- **Build-a-Five** — compose a custom lineup and get a live rating estimate
- **Player Impact** — on/off net rating differential for every player
- **Counter Builder** — find lineups best suited to beat a specific opponent style
- **Lineup Drawer** — full splits (by period, opponent, game) for any lineup
- **Compare Tray** — side-by-side comparison of up to 3 lineups

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/lineups` | League-wide lineup summary (filterable, sortable) |
| GET | `/api/v1/lineups/detail` | Full splits for a specific lineup |
| GET | `/api/v1/players/impact` | On/off impact for all players |
| GET | `/api/v1/meta` | Teams, players, games, baselines |

---

## Local Setup

### Database

```bash
createuser okcapplicant --createdb
createdb okc
psql okc
```

```sql
create schema app;
alter user okcapplicant with password 'thunder';
grant all on schema app to okcapplicant;
```

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
PYTHONPATH=. python scripts/ingest_raw_data.py
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:4200`.
