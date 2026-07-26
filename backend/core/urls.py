from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BackupDownloadView, CategoryViewSet, CompanySettingView, CustomerViewSet, DashboardView,
    EmployeeViewSet, ExpenseCategoryViewSet, ExpenseViewSet, LoginView, LogoutView, MeView,
    PaymentViewSet, ProductViewSet, ProfitLossView, PurchaseViewSet, SaleViewSet,
    StockMovementViewSet, SupplierViewSet
)

router = DefaultRouter()
router.register('customers', CustomerViewSet)
router.register('suppliers', SupplierViewSet)
router.register('categories', CategoryViewSet)
router.register('products', ProductViewSet)
router.register('stock-movements', StockMovementViewSet)
router.register('sales', SaleViewSet)
router.register('purchases', PurchaseViewSet)
router.register('payments', PaymentViewSet)
router.register('expense-categories', ExpenseCategoryViewSet)
router.register('expenses', ExpenseViewSet)
router.register('employees', EmployeeViewSet)

urlpatterns = [
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('dashboard/', DashboardView.as_view()),
    path('profit-loss/', ProfitLossView.as_view()),
    path('settings/', CompanySettingView.as_view()),
    path('backup/download/', BackupDownloadView.as_view()),
    path('', include(router.urls)),
]
