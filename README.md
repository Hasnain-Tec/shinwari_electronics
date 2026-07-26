# MedTrade Inventory — React + Django REST + SQLite

A local-first inventory, sales, purchase, invoicing and accounting MVP designed for VS Code development first, then GitHub source control and later deployment.

## Included modules

- Token login and employee accounts
- Dashboard analytics
- Customer management and receivable balances
- Supplier management and payable balances
- Categories and products
- Embedded SQLite database
- Stock movement ledger
- Opening stock and stock adjustments
- Sales with transactional stock reduction
- Sales cancellation with stock reversal safeguards
- Purchases with transactional stock increase
- Purchase cancellation with safeguards
- English-only PDF tax invoices
- Customer receipts and supplier payments
- PDF payment receipts
- Expense tracking
- Profit & Loss report
- Changeable base currency and VAT settings
- Company, document prefix and bank settings
- Downloadable SQLite backup
- Responsive React interface

## Architecture

```text
React + Vite frontend
        |
        | HTTP JSON API
        v
Django REST Framework backend
        |
        v
SQLite database
```

## Requirements on the developer PC

- Python 3.10 or newer
- Node.js compatible with Vite 8 (Node 20.19+ or 22.12+)
- VS Code is optional but recommended

The customer packaging step comes later. This source project is intentionally for development and testing first.

## Fastest Windows setup

1. Extract the ZIP.
2. Double-click `SETUP_WINDOWS.bat`.
3. Wait for both Python and React packages to finish.
4. Double-click `RUN_WINDOWS.bat`.
5. Browser opens at `http://127.0.0.1:5173`.

Default login:

```text
Username: admin
Password: admin123
```

## Manual VS Code setup

Open the project root in VS Code.

### Terminal 1 — backend

PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

If PowerShell blocks activation, use the virtual environment Python directly:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Backend API runs at:

```text
http://127.0.0.1:8000/api/
```

### Terminal 2 — frontend

```powershell
cd frontend
npm install --no-audit --no-fund
npm run dev
```

Frontend runs at:

```text
http://127.0.0.1:5173
```

## Important security note

The included `SECRET_KEY`, `DEBUG=True`, localhost CORS rules and default `admin/admin123` account are for local development only. Before any public deployment, use environment variables, disable debug mode, change credentials, configure allowed hosts/CORS precisely, and use a production WSGI/ASGI server.

## Database

Development database:

```text
backend/db.sqlite3
```

It is excluded from Git by `.gitignore`, so business data is not accidentally uploaded to GitHub.

## API highlights

```text
POST /api/auth/login/
GET  /api/auth/me/
GET  /api/dashboard/
GET  /api/customers/
GET  /api/suppliers/
GET  /api/products/
POST /api/products/adjust_stock/
GET  /api/stock-movements/
GET  /api/sales/
POST /api/sales/
POST /api/sales/{id}/cancel/
GET  /api/sales/{id}/invoice_pdf/
GET  /api/purchases/
POST /api/purchases/
POST /api/purchases/{id}/cancel/
GET  /api/payments/
GET  /api/payments/{id}/receipt_pdf/
GET  /api/expenses/
GET  /api/profit-loss/
GET  /api/settings/
PUT  /api/settings/
GET  /api/backup/download/
```

## PythonAnywhere Deployment Guide

This project is pre-configured for seamless deployment on PythonAnywhere (`shinwari.pythonanywhere.com`).

### 1. Clone Repository on PythonAnywhere
Open a Bash console on PythonAnywhere and run:
```bash
git clone https://github.com/Hasnain-Tec/shinwari_electronics.git
cd shinwari_electronics/backend
```

### 2. Set Up Virtual Environment & Install Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_demo  # Sets up default admin user (admin / admin123)
```

### 3. Configure PythonAnywhere Web App Tab
1. Go to the **Web** tab on PythonAnywhere.
2. Create a new Web App (select **Manual configuration** with **Python 3.10** or higher).
3. Set Virtualenv path to: `/home/shinwari/shinwari_electronics/backend/.venv`
4. Edit the **WSGI configuration file** (click the link under Code heading) and replace contents with:
```python
import os
import sys

path = '/home/shinwari/shinwari_electronics/backend'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'medtrade.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### 4. Configure Static Files Mapping in Web Tab
In the **Static files** section on PythonAnywhere, set:
- **URL**: `/static/` -> **Directory**: `/home/shinwari/shinwari_electronics/backend/staticfiles`
- **URL**: `/assets/` -> **Directory**: `/home/shinwari/shinwari_electronics/backend/frontend_dist/assets`

### 5. Reload Your Web App
Click the green **Reload** button at the top of the Web tab.
Your React + Django application is now live at:
`https://shinwari.pythonanywhere.com`

---

## GitHub Setup & Verification

Read `GITHUB_GUIDE.md` after local testing passes.

