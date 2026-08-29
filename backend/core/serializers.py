from decimal import Decimal, ROUND_HALF_UP
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Category, CompanySetting, Customer, EmployeeProfile, Expense, ExpenseCategory,
    Payment, Product, Purchase, PurchaseItem, Sale, SaleItem, StockMovement, Supplier
)
from .utils import get_company_setting, next_number

TWOPLACES = Decimal('0.01')


def money(value):
    return Decimal(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='employee_profile.role', read_only=True, default='ADMIN')

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'is_active', 'role']


class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role_input = serializers.ChoiceField(choices=EmployeeProfile.ROLE_CHOICES, write_only=True, required=False)
    role = serializers.SerializerMethodField(read_only=True)
    role_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'is_active', 'password', 'role_input', 'role', 'role_display']

    def get_role(self, obj):
        profile = getattr(obj, 'employee_profile', None)
        return profile.role if profile else 'ADMIN'

    def get_role_display(self, obj):
        profile = getattr(obj, 'employee_profile', None)
        return profile.get_role_display() if profile else 'Admin'

    def create(self, validated_data):
        role = validated_data.pop('role_input', 'SALES')
        password = validated_data.pop('password', '')
        if not password:
            raise serializers.ValidationError({'password': 'Password is required for a new employee.'})
        user = User.objects.create_user(password=password, **validated_data)
        EmployeeProfile.objects.create(user=user, role=role)
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role_input', None)
        password = validated_data.pop('password', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role:
            profile, _ = EmployeeProfile.objects.get_or_create(user=instance)
            profile.role = role
            profile.save(update_fields=['role'])
        return instance


class CompanySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySetting
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class CustomerSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'

    def get_outstanding_balance(self, obj):
        sales_total = sum((s.total for s in obj.sales.exclude(status='CANCELLED')), Decimal('0'))
        payments_total = sum((p.amount for p in obj.payments.all()), Decimal('0'))
        balance = money(obj.opening_balance + sales_total - payments_total)
        return max(balance, Decimal('0'))


class SupplierSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = '__all__'

    def get_outstanding_balance(self, obj):
        purchase_total = sum((p.total for p in obj.purchases.exclude(status='CANCELLED')), Decimal('0'))
        payments_total = sum((p.amount for p in obj.payments.all()), Decimal('0'))
        return money(obj.opening_balance + purchase_total - payments_total)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    low_stock = serializers.SerializerMethodField()
    opening_stock = serializers.DecimalField(max_digits=14, decimal_places=3, write_only=True, required=False, default=Decimal('0'))

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['current_stock']

    def get_low_stock(self, obj):
        return obj.current_stock <= obj.min_stock

    def create(self, validated_data):
        opening = validated_data.pop('opening_stock', Decimal('0'))
        product = Product.objects.create(current_stock=opening, **validated_data)
        if opening != 0:
            request = self.context.get('request')
            StockMovement.objects.create(
                product=product, movement_type='OPENING_STOCK', quantity=opening,
                balance_after=opening, note='Opening stock',
                created_by=request.user if request and request.user.is_authenticated else None,
            )
        return product


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'


class StockAdjustmentSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    adjustment_type = serializers.ChoiceField(choices=['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0.001'))
    note = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=validated_data['product'].pk)
            qty = validated_data['quantity']
            if validated_data['adjustment_type'] == 'ADJUSTMENT_OUT':
                if product.current_stock < qty:
                    raise serializers.ValidationError({'quantity': 'Insufficient stock for this adjustment.'})
                signed_qty = -qty
            else:
                signed_qty = qty
            product.current_stock += signed_qty
            product.save(update_fields=['current_stock', 'updated_at'])
            return StockMovement.objects.create(
                product=product,
                movement_type=validated_data['adjustment_type'],
                quantity=signed_qty,
                balance_after=product.current_stock,
                note=validated_data.get('note', ''),
                created_by=self.context['request'].user,
            )


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = SaleItem
        fields = '__all__'
        read_only_fields = ['sale', 'description', 'vat_amount', 'line_total', 'cost_price']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    salesperson_name = serializers.CharField(source='salesperson.username', read_only=True)
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = '__all__'
        read_only_fields = ['invoice_no', 'subtotal', 'discount_total', 'vat_total', 'total', 'status', 'salesperson']

    def get_balance_due(self, obj):
        if obj.customer_id:
            paid = sum(
                (p.amount for p in obj.customer.payments.filter(sale=obj)),
                Decimal('0')
            )
        else:
            paid = obj.amount_paid
        return max(money(obj.total - paid), Decimal('0'))

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('At least one sale item is required.')
        return items

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']
        company = get_company_setting()
        with transaction.atomic():
            sale = Sale.objects.create(
                invoice_no=next_number(company.invoice_prefix, Sale, 'invoice_no'),
                salesperson=request.user,
                status='CONFIRMED',
                **validated_data,
            )
            subtotal = Decimal('0')
            discount_total = Decimal('0')
            vat_total = Decimal('0')
            for item_data in items_data:
                product = Product.objects.select_for_update().get(pk=item_data['product'].pk)
                qty = item_data['quantity']
                if product.current_stock < qty:
                    raise serializers.ValidationError({'items': f'Insufficient stock for {product.name}. Available: {product.current_stock}'})
                unit_price = item_data.get('unit_price', product.selling_price)
                discount = item_data.get('discount', Decimal('0'))
                vat_rate = item_data.get('vat_rate', product.vat_rate)
                gross = money(qty * unit_price)
                if discount > gross:
                    raise serializers.ValidationError({'items': f'Discount exceeds line amount for {product.name}.'})
                taxable = money(gross - discount)
                vat_amount = money(taxable * vat_rate / Decimal('100'))
                line_total = money(taxable + vat_amount)
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    description=product.name,
                    quantity=qty,
                    unit_price=unit_price,
                    discount=discount,
                    vat_rate=vat_rate,
                    vat_amount=vat_amount,
                    line_total=line_total,
                    cost_price=product.purchase_price,
                )
                product.current_stock -= qty
                product.save(update_fields=['current_stock', 'updated_at'])
                StockMovement.objects.create(
                    product=product,
                    movement_type='SALE',
                    quantity=-qty,
                    balance_after=product.current_stock,
                    reference_type='SALE',
                    reference_id=sale.id,
                    note=sale.invoice_no,
                    created_by=request.user,
                )
                subtotal += gross
                discount_total += discount
                vat_total += vat_amount
            sale.subtotal = money(subtotal)
            sale.discount_total = money(discount_total)
            sale.vat_total = money(vat_total)
            sale.total = money(subtotal - discount_total + vat_total)
            sale.save(update_fields=['subtotal', 'discount_total', 'vat_total', 'total', 'updated_at'])
            if sale.amount_paid > 0 and sale.customer:
                Payment.objects.create(
                    receipt_no=next_number(company.receipt_prefix, Payment, 'receipt_no'),
                    party_type='CUSTOMER', customer=sale.customer, sale=sale,
                    date=sale.date, amount=sale.amount_paid, payment_method=sale.payment_mode if sale.payment_mode in ['CASH','BANK','CARD','CHEQUE'] else 'CASH',
                    notes=f'Auto receipt for {sale.invoice_no}', created_by=request.user,
                )
            return sale


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = PurchaseItem
        fields = '__all__'
        read_only_fields = ['purchase', 'description', 'vat_amount', 'line_total']


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = '__all__'
        read_only_fields = ['purchase_no', 'subtotal', 'discount_total', 'vat_total', 'total', 'status', 'created_by']

    def get_balance_due(self, obj):
        return money(obj.total - obj.amount_paid)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('At least one purchase item is required.')
        return items

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']
        company = get_company_setting()
        with transaction.atomic():
            purchase = Purchase.objects.create(
                purchase_no=next_number(company.purchase_prefix, Purchase, 'purchase_no'),
                created_by=request.user,
                status='CONFIRMED',
                **validated_data,
            )
            subtotal = Decimal('0')
            discount_total = Decimal('0')
            vat_total = Decimal('0')
            for item_data in items_data:
                product = Product.objects.select_for_update().get(pk=item_data['product'].pk)
                qty = item_data['quantity']
                unit_cost = item_data.get('unit_cost', product.purchase_price)
                discount = item_data.get('discount', Decimal('0'))
                vat_rate = item_data.get('vat_rate', product.vat_rate)
                gross = money(qty * unit_cost)
                if discount > gross:
                    raise serializers.ValidationError({'items': f'Discount exceeds line amount for {product.name}.'})
                taxable = money(gross - discount)
                vat_amount = money(taxable * vat_rate / Decimal('100'))
                line_total = money(taxable + vat_amount)
                PurchaseItem.objects.create(
                    purchase=purchase, product=product, description=product.name,
                    quantity=qty, unit_cost=unit_cost, discount=discount,
                    vat_rate=vat_rate, vat_amount=vat_amount, line_total=line_total,
                )
                product.current_stock += qty
                product.purchase_price = unit_cost
                product.save(update_fields=['current_stock', 'purchase_price', 'updated_at'])
                StockMovement.objects.create(
                    product=product, movement_type='PURCHASE', quantity=qty,
                    balance_after=product.current_stock, reference_type='PURCHASE',
                    reference_id=purchase.id, note=purchase.purchase_no, created_by=request.user,
                )
                subtotal += gross
                discount_total += discount
                vat_total += vat_amount
            purchase.subtotal = money(subtotal)
            purchase.discount_total = money(discount_total)
            purchase.vat_total = money(vat_total)
            purchase.total = money(subtotal - discount_total + vat_total)
            if purchase.amount_paid > purchase.total:
                raise serializers.ValidationError({'amount_paid': 'Paid amount cannot exceed purchase total.'})
            purchase.save(update_fields=['subtotal', 'discount_total', 'vat_total', 'total', 'updated_at'])
            if purchase.amount_paid > 0 and purchase.supplier:
                Payment.objects.create(
                    receipt_no=next_number(company.receipt_prefix, Payment, 'receipt_no'),
                    party_type='SUPPLIER', supplier=purchase.supplier, purchase=purchase,
                    date=purchase.date, amount=purchase.amount_paid, payment_method=purchase.payment_mode if purchase.payment_mode in ['CASH','BANK','CARD','CHEQUE'] else 'CASH',
                    notes=f'Auto payment for {purchase.purchase_no}', created_by=request.user,
                )
            return purchase


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['receipt_no', 'created_by']

    def validate(self, attrs):
        party_type = attrs.get('party_type', getattr(self.instance, 'party_type', None))
        customer = attrs.get('customer', getattr(self.instance, 'customer', None))
        supplier = attrs.get('supplier', getattr(self.instance, 'supplier', None))
        if party_type == 'CUSTOMER' and not customer:
            raise serializers.ValidationError({'customer': 'Customer is required for a customer receipt.'})
        if party_type == 'SUPPLIER' and not supplier:
            raise serializers.ValidationError({'supplier': 'Supplier is required for a supplier payment.'})
        return attrs

    def create(self, validated_data):
        company = get_company_setting()

        # If the API supplies a sale, preserve that relationship so invoice
        # balance and payment history can be calculated from actual payments.
        return Payment.objects.create(
            receipt_no=next_number(company.receipt_prefix, Payment, 'receipt_no'),
            created_by=self.context['request'].user,
            **validated_data,
        )


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['created_by']

    def create(self, validated_data):
        return Expense.objects.create(created_by=self.context['request'].user, **validated_data)
