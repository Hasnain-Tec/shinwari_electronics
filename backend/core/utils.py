from datetime import date
from django.db.models import Max
from .models import CompanySetting


def get_company_setting():
    obj, _ = CompanySetting.objects.get_or_create(pk=1)
    return obj


def next_number(prefix, model, field_name):
    year = date.today().year
    base = f'{prefix}-{year}-'
    last = model.objects.filter(**{f'{field_name}__startswith': base}).aggregate(m=Max(field_name))['m']
    if not last:
        seq = 1
    else:
        try:
            seq = int(last.rsplit('-', 1)[1]) + 1
        except (ValueError, IndexError):
            seq = model.objects.count() + 1
    return f'{base}{seq:05d}'
