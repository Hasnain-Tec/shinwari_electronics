from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, Sum, DecimalField, ExpressionWrapper
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, CompanySetting, Customer, Expense, ExpenseCategory, Payment, Product, Purchase, Sale, StockMovement, Supplier
from .pdf import build_invoice_pdf, build_receipt_pdf
from .permissions import IsAdminRole
from .serializers import (
    CategorySerializer, CompanySettingSerializer, CustomerSerializer, EmployeeCreateUpdateSerializer,
    ExpenseCategorySerializer, ExpenseSerializer, PaymentSerializer, ProductSerializer,
    PurchaseSerializer, SaleSerializer, StockAdjustmentSerializer, StockMovementSerializer,
    SupplierSerializer, UserSerializer
)
from .utils import get_company_setting


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        user = authenticate(request, username=username, password=password)
        if not user or not user.is_active:
            return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').all().order_by('name')
    serializer_class = ProductSerializer

    @action(detail=False, methods=['post'])
    def adjust_stock(self, request):
        serializer = StockAdjustmentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        movement = serializer.save()
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related('product', 'created_by').all()
    serializer_class = StockMovementSerializer


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related('customer', 'salesperson').prefetch_related('items__product').all()
    serializer_class = SaleSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            sale = Sale.objects.select_for_update().prefetch_related('items__product').get(pk=pk)
            if sale.status == 'CANCELLED':
                return Response({'detail': 'Sale is already cancelled.'}, status=400)
            if sale.amount_paid > 0:
                return Response({'detail': 'Cannot cancel a sale with recorded payment. Reverse payment first.'}, status=400)
            for item in sale.items.all():
                product = Product.objects.select_for_update().get(pk=item.product_id)
                product.current_stock += item.quantity
                product.save(update_fields=['current_stock', 'updated_at'])
                StockMovement.objects.create(product=product, movement_type='SALE_CANCEL', quantity=item.quantity, balance_after=product.current_stock, reference_type='SALE', reference_id=sale.id, note=f'Cancel {sale.invoice_no}', created_by=request.user)
            sale.status = 'CANCELLED'
            sale.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=['get'])
    def invoice_pdf(self, request, pk=None):
        sale = self.get_object()
        pdf = build_invoice_pdf(sale)
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{sale.invoice_no}.pdf"'
        return response


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related('supplier', 'created_by').prefetch_related('items__product').all()
    serializer_class = PurchaseSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            purchase = Purchase.objects.select_for_update().prefetch_related('items__product').get(pk=pk)
            if purchase.status == 'CANCELLED':
                return Response({'detail': 'Purchase is already cancelled.'}, status=400)
            if purchase.amount_paid > 0:
                return Response({'detail': 'Cannot cancel a purchase with recorded payment. Reverse payment first.'}, status=400)
            for item in purchase.items.all():
                product = Product.objects.select_for_update().get(pk=item.product_id)
                if product.current_stock < item.quantity:
                    return Response({'detail': f'Cannot cancel. Current stock for {product.name} is lower than purchased quantity.'}, status=400)
                product.current_stock -= item.quantity
                product.save(update_fields=['current_stock', 'updated_at'])
                StockMovement.objects.create(product=product, movement_type='PURCHASE_CANCEL', quantity=-item.quantity, balance_after=product.current_stock, reference_type='PURCHASE', reference_id=purchase.id, note=f'Cancel {purchase.purchase_no}', created_by=request.user)
            purchase.status = 'CANCELLED'
            purchase.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(purchase).data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('customer', 'supplier', 'sale', 'purchase').all()
    serializer_class = PaymentSerializer

    @action(detail=True, methods=['get'])
    def receipt_pdf(self, request, pk=None):
        payment = self.get_object()
        pdf = build_receipt_pdf(payment)
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{payment.receipt_no}.pdf"'
        return response


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all().order_by('name')
    serializer_class = ExpenseCategorySerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('category', 'created_by').all()
    serializer_class = ExpenseSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = EmployeeCreateUpdateSerializer
    permission_classes = [IsAdminRole]


class CompanySettingView(APIView):
    def get(self, request):
        return Response(CompanySettingSerializer(get_company_setting()).data)

    def put(self, request):
        obj = get_company_setting()
        serializer = CompanySettingSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        active_sales = Sale.objects.exclude(status='CANCELLED')
        active_purchases = Purchase.objects.exclude(status='CANCELLED')

        sales_today = active_sales.filter(date=today).aggregate(v=Sum('total'))['v'] or Decimal('0')
        sales_month = active_sales.filter(date__gte=month_start, date__lte=today).aggregate(v=Sum('total'))['v'] or Decimal('0')
        purchases_month = active_purchases.filter(date__gte=month_start, date__lte=today).aggregate(v=Sum('total'))['v'] or Decimal('0')
        expenses_month = Expense.objects.filter(date__gte=month_start, date__lte=today).aggregate(v=Sum('amount'))['v'] or Decimal('0')

        stock_value_expr = ExpressionWrapper(
            F('current_stock') * F('purchase_price'),
            output_field=DecimalField(max_digits=20, decimal_places=2)
        )
        stock_value = Product.objects.aggregate(v=Sum(stock_value_expr))['v'] or Decimal('0')

        customer_opening = Customer.objects.aggregate(v=Sum('opening_balance'))['v'] or Decimal('0')
        customer_sales = active_sales.filter(customer__isnull=False).aggregate(v=Sum('total'))['v'] or Decimal('0')
        customer_receipts = Payment.objects.filter(party_type='CUSTOMER').aggregate(v=Sum('amount'))['v'] or Decimal('0')
        receivables = customer_opening + customer_sales - customer_receipts

        supplier_opening = Supplier.objects.aggregate(v=Sum('opening_balance'))['v'] or Decimal('0')
        supplier_purchases = active_purchases.filter(supplier__isnull=False).aggregate(v=Sum('total'))['v'] or Decimal('0')
        supplier_payments = Payment.objects.filter(party_type='SUPPLIER').aggregate(v=Sum('amount'))['v'] or Decimal('0')
        payables = supplier_opening + supplier_purchases - supplier_payments

        pnl = profit_loss_values(month_start, today)

        trend = []
        for i in range(179, -1, -1):
            d = today - timedelta(days=i)
            total = active_sales.filter(date=d).aggregate(v=Sum('total'))['v'] or Decimal('0')
            trend.append({'date': str(d), 'sales': total})

        low_stock = ProductSerializer(
            Product.objects.filter(current_stock__lte=F('min_stock')).order_by('current_stock')[:10],
            many=True
        ).data

        recent_sales = SaleSerializer(
            active_sales.select_related('customer','salesperson').prefetch_related('items__product')[:8],
            many=True
        ).data

        return Response({
            'sales_today': sales_today,
            'sales_month': sales_month,
            'purchases_month': purchases_month,
            'expenses_month': expenses_month,
            'stock_value': stock_value,
            'receivables': receivables,
            'payables': payables,
            'net_profit_month': pnl['net_profit'],
            'trend': trend,
            'low_stock': low_stock,
            'recent_sales': recent_sales,
        })


def profit_loss_values(date_from, date_to):
    sales_items = Sale.objects.exclude(status='CANCELLED').filter(date__gte=date_from, date__lte=date_to, items__isnull=False)
    revenue = sales_items.aggregate(v=Sum(F('items__line_total') - F('items__vat_amount')))['v'] or Decimal('0')
    cogs_expr = ExpressionWrapper(F('items__quantity') * F('items__cost_price'), output_field=DecimalField(max_digits=20, decimal_places=2))
    cogs = sales_items.aggregate(v=Sum(cogs_expr))['v'] or Decimal('0')
    expenses = Expense.objects.filter(date__gte=date_from, date__lte=date_to).aggregate(v=Sum('amount'))['v'] or Decimal('0')
    gross_profit = revenue - cogs
    return {'revenue': revenue, 'cogs': cogs, 'gross_profit': gross_profit, 'expenses': expenses, 'net_profit': gross_profit - expenses}


class ProfitLossView(APIView):
    def get(self, request):
        today = timezone.localdate()
        date_from = request.query_params.get('date_from') or str(today.replace(day=1))
        date_to = request.query_params.get('date_to') or str(today)
        values = profit_loss_values(date_from, date_to)
        values.update({'date_from': date_from, 'date_to': date_to})
        return Response(values)


class BackupDownloadView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        db_path = Path(settings.DATABASES['default']['NAME'])
        if not db_path.exists():
            return Response({'detail': 'Database file not found.'}, status=404)
        filename = f'medtrade-backup-{timezone.localdate()}.sqlite3'
        return FileResponse(open(db_path, 'rb'), as_attachment=True, filename=filename)
