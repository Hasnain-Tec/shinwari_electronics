from django.contrib import admin
from .models import *

for model in [CompanySetting, Customer, Supplier, Category, Product, StockMovement, Sale, SaleItem, Purchase, PurchaseItem, Payment, ExpenseCategory, Expense, EmployeeProfile]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
