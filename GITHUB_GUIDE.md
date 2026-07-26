# GitHub Guide — after local testing

Do not upload the project until local login, sales, purchases and PDFs have been tested.

## 1. Create an empty repository on GitHub

Example name:

```text
medtrade-inventory
```

Do not add a README from GitHub if you already have this project README.

## 2. In the project root

```bash
git init
git add .
git commit -m "Initial React Django inventory MVP"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 3. Files intentionally excluded

The `.gitignore` excludes:

- `backend/.venv/`
- `backend/db.sqlite3`
- `frontend/node_modules/`
- `frontend/dist/`
- local environment files

Never commit real customer business data, production secrets or database backups to a public repository.

## 4. Important distinction

GitHub stores the Django source code. A normal GitHub repository does not itself execute the Django server. Public online access later requires a Python-capable deployment target or a packaged local application.
