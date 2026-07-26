from decimal import Decimal
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CompanySetting(TimeStampedModel):
    company_name = models.CharField(max_length=180, default='Shinwari Electronics and Decoration')
    address = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=60, blank=True)
    trn = models.CharField(max_length=80, blank=True)
    currency_code = models.CharField(max_length=10, default='AED')
    currency_symbol = models.CharField(max_length=10, default='AED')
    default_vat = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    invoice_prefix = models.CharField(max_length=20, default='INV')
    purchase_prefix = models.CharField(max_length=20, default='PUR')
    receipt_prefix = models.CharField(max_length=20, default='REC')
    terms = models.TextField(blank=True, default='Goods once sold are subject to the company return policy.')
    bank_name = models.CharField(max_length=120, blank=True)
    account_title = models.CharField(max_length=120, blank=True)
    account_number = models.CharField(max_length=100, blank=True)
    iban = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.company_name


class Customer(TimeStampedModel):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160)
    company_name = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=60, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    trn = models.CharField(max_length=80, blank=True)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Supplier(TimeStampedModel):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160)
    company_name = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=60, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    trn = models.CharField(max_length=80, blank=True)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    bank_details = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Category(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    sku = models.CharField(max_length=60, unique=True)
    barcode = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    brand = models.CharField(max_length=120, blank=True)
    unit = models.CharField(max_length=40, default='pcs')
    purchase_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    current_stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    batch_no = models.CharField(max_length=100, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    shelf_location = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.sku} - {self.name}'


class StockMovement(TimeStampedModel):
    MOVEMENT_TYPES = [
        ('OPENING_STOCK', 'Opening Stock'),
        ('PURCHASE', 'Purchase'),
        ('SALE', 'Sale'),
        ('SALE_CANCEL', 'Sale Cancel'),
        ('PURCHASE_CANCEL', 'Purchase Cancel'),
        ('ADJUSTMENT_IN', 'Adjustment In'),
        ('ADJUSTMENT_OUT', 'Adjustment Out'),
    ]
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='stock_movements')
    movement_type = models.CharField(max_length=30, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    balance_after = models.DecimalField(max_digits=14, decimal_places=3)
    reference_type = models.CharField(max_length=40, blank=True)
    reference_id = models.PositiveBigIntegerField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']


class Sale(TimeStampedModel):
    STATUS_CHOICES = [('CONFIRMED', 'Confirmed'), ('CANCELLED', 'Cancelled')]
    PAYMENT_CHOICES = [('CASH', 'Cash'), ('CREDIT', 'Credit'), ('BANK', 'Bank Transfer'), ('CARD', 'Card'), ('CHEQUE', 'Cheque')]

    invoice_no = models.CharField(max_length=60, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True, related_name='sales')
    date = models.DateField()
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='CREDIT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    salesperson = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_created')

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return self.invoice_no


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    description = models.CharField(max_length=240)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class Purchase(TimeStampedModel):
    STATUS_CHOICES = [('CONFIRMED', 'Confirmed'), ('CANCELLED', 'Cancelled')]
    PAYMENT_CHOICES = [('CASH', 'Cash'), ('CREDIT', 'Credit'), ('BANK', 'Bank Transfer'), ('CARD', 'Card'), ('CHEQUE', 'Cheque')]

    purchase_no = models.CharField(max_length=60, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name='purchases')
    date = models.DateField()
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='CREDIT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases_created')

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return self.purchase_no


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    description = models.CharField(max_length=240)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class Payment(TimeStampedModel):
    PARTY_TYPES = [('CUSTOMER', 'Customer Receipt'), ('SUPPLIER', 'Supplier Payment')]
    METHODS = [('CASH', 'Cash'), ('BANK', 'Bank Transfer'), ('CARD', 'Card'), ('CHEQUE', 'Cheque'), ('OTHER', 'Other')]

    receipt_no = models.CharField(max_length=60, unique=True)
    party_type = models.CharField(max_length=20, choices=PARTY_TYPES)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True, related_name='payments')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name='payments')
    sale = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_method = models.CharField(max_length=20, choices=METHODS, default='CASH')
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date', '-id']


class ExpenseCategory(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self):
        return self.name


class Expense(TimeStampedModel):
    date = models.DateField()
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    description = models.CharField(max_length=255)
    paid_to = models.CharField(max_length=160, blank=True)
    payment_method = models.CharField(max_length=30, default='CASH')
    reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date', '-id']


class EmployeeProfile(TimeStampedModel):
    ROLE_CHOICES = [('ADMIN', 'Admin'), ('SALES', 'Sales'), ('ACCOUNTANT', 'Accountant'), ('STORE_KEEPER', 'Store Keeper')]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='SALES')
    phone = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return f'{self.user.username} - {self.role}'
