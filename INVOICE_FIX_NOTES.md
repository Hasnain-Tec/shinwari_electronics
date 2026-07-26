# Invoice Fix - Important

This build replaces the earlier incomplete invoice workflow.

## What is fixed

- Sales page is now explicitly **Sales & Invoices**.
- Creating a sale saves stock/customer data and immediately shows **Invoice Generated Successfully**.
- Each completed sale has visible **Preview Invoice** and **Download PDF** actions.
- PDF layout is English-only and follows the provided reference structure:
  - company header
  - customer box
  - tax invoice box
  - invoice number, date, payment mode, salesperson
  - item number
  - description
  - quantity
  - unit price
  - discount
  - taxable amount
  - VAT rate
  - VAT amount
  - total with VAT
  - subtotal
  - discount
  - gross total
  - VAT total
  - invoice total
  - terms and conditions
  - receiver details
  - prepared by
  - bank details
- Currency uses Company Settings dynamically.
- Long invoices continue to additional pages instead of silently clipping rows.

## Test flow

1. Start Django backend.
2. Start React frontend.
3. Login with `admin / admin123`.
4. Add a customer.
5. Add a product with stock.
6. Open **Sales & Invoices**.
7. Click **New Sale / Invoice**.
8. Add one or more products.
9. Click **Save Sale & Generate Invoice**.
10. Click **Preview Invoice** or **Download PDF**.

A rendered example is included as `INVOICE_REFERENCE_TEST.pdf`.
