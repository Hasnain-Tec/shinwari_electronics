# Validation Performed Before ZIP Creation

The project was checked in the build environment with:

- `python manage.py check` — passed
- `python manage.py makemigrations --check --dry-run` — no model drift
- Python bytecode compilation — passed
- Django migrations — passed
- Seed command — passed
- React dependency installation — completed with 19 packages added in the test environment
- `npm run build` with Vite 8.1.3 — passed

API smoke tests passed for:

- Admin login
- Customer creation
- Supplier creation
- Product creation with opening stock
- Opening stock movement creation
- Sale creation
- Automatic stock decrease
- Invoice PDF generation
- Purchase creation
- Automatic stock increase
- Customer payment creation
- Receipt PDF generation
- Expense creation
- Dashboard response
- Profit & Loss calculation
- Database backup download
- Employee creation
- Employee role update

This validation demonstrates a runnable MVP flow; it is not a substitute for user acceptance testing or a production security audit.
