from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Category, CompanySetting, EmployeeProfile, ExpenseCategory


class Command(BaseCommand):
    help = 'Create initial admin user and default master data.'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(username='admin', defaults={'email': 'admin@example.com', 'first_name': 'System', 'last_name': 'Admin', 'is_staff': True, 'is_superuser': True})
        if created:
            user.set_password('admin123')
            user.save()
        else:
            user.is_staff = True
            user.is_superuser = True
            user.save(update_fields=['is_staff', 'is_superuser'])
        EmployeeProfile.objects.get_or_create(user=user, defaults={'role': 'ADMIN'})
        CompanySetting.objects.get_or_create(pk=1)
        for name in ['Screens', 'Electronic Equipment', 'Mobile Accessories', 'Cables & Chargers','Speakers & Sound','Lights & Decoration','Repair Parts','General']:
            Category.objects.get_or_create(name=name)
        for name in ['Rent', 'Salary', 'Electricity', 'Internet', 'Transportation', 'Fuel', 'Office Supplies', 'Marketing', 'Maintenance', 'Bank Charges', 'Other']:
            ExpenseCategory.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('Seed complete. Login: admin / admin123'))
