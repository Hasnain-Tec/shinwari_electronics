import os
from io import BytesIO
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.utils import timezone

# Libraries to fix Urdu RTL joining & black box issues
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_URDU_LIBS = True
except ImportError:
    HAS_URDU_LIBS = False

from .utils import get_company_setting

# Register custom Urdu font if present
FONT_DIR = os.path.dirname(__file__)
URDU_FONT_PATH = os.path.join(FONT_DIR, 'NotoNaskhArabic-Regular.ttf')
URDU_FONT_NAME = 'Helvetica'
if os.path.exists(URDU_FONT_PATH):
    pdfmetrics.registerFont(TTFont('UrduFont', URDU_FONT_PATH))
    URDU_FONT_NAME = 'UrduFont'

DARK = colors.HexColor('#000000')

def _decimal(value):
    try:
        return Decimal(value or 0)
    except Exception:
        return Decimal('0')

def _money_fmt(value):
    val = _decimal(value)
    return f'{val:,.0f}' if val % 1 == 0 else f'{val:,.2f}'

def _qty_fmt(value):
    val = _decimal(value)
    return f'{val:,.0f}' if val % 1 == 0 else f'{val:,.2f}'

def _safe(value):
    return str(value or '').strip()

def _format_urdu_text(text):
    """ Fixes Urdu joining and RTL display """
    if not text:
        return ""
    if HAS_URDU_LIBS:
        try:
            reshaped = arabic_reshaper.reshape(text)
            return get_display(reshaped)
        except Exception:
            return text
    return text

def _draw_wrapped_urdu(c, x, y_top, text, width, font_name=URDU_FONT_NAME, size=8.5, leading=12):
    """ Draws multi-line Urdu/English text dynamically """
    if not text:
        return
    c.setFont(font_name, size)
    c.setFillColor(DARK)
    
    # Split into lines by newline or auto-wrap
    raw_lines = text.split('\n')
    lines = []
    for r_line in raw_lines:
        words = r_line.split()
        current_line = []
        for word in words:
            test_line = ' '.join(current_line + [word])
            formatted_test = _format_urdu_text(test_line)
            if c.stringWidth(formatted_test, font_name, size) <= width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
        if current_line:
            lines.append(' '.join(current_line))
            
    curr_y = y_top
    for line in lines:
        formatted_line = _format_urdu_text(line)
        c.drawRightString(x, curr_y, formatted_line)
        curr_y -= leading

def _get_previous_balance(sale):
    for name in ['previous_balance', 'previous_amount', 'opening_balance', 'balance_brought_forward', 'old_balance']:
        if hasattr(sale, name):
            val = _decimal(getattr(sale, name))
            if val != Decimal('0'):
                return val
    customer = getattr(sale, 'customer', None)
    if customer:
        for name in ['previous_balance', 'opening_balance', 'balance']:
            if hasattr(customer, name):
                return _decimal(getattr(customer, name))
    return Decimal('0')

def _get_total_paid(sale):
    if hasattr(sale, 'payments') or hasattr(sale, 'sale_payments'):
        relation = getattr(sale, 'payments', None) or getattr(sale, 'sale_payments', None)
        if relation and hasattr(relation, 'all'):
            return sum(_decimal(getattr(p, 'amount', 0)) for p in relation.all())
    return _decimal(getattr(sale, 'amount_paid', getattr(sale, 'paid_amount', 0)))

def build_invoice_pdf(sale):
    setting = get_company_setting()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    margin_left = 15 * mm
    margin_right = 15 * mm
    printable_width = w - margin_left - margin_right

    # 1. HEADER AREA FROM SETTINGS
    y = h - 18 * mm
    c.setFont('Helvetica-Bold', 14)
    c.drawString(margin_left, y, _safe(setting.company_name or 'AHMAD SHINWARI AUTO Wholesale Dealer'))

    y -= 5 * mm
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin_left, y, 'Address         :')
    c.setFont('Helvetica', 9)
    c.drawString(margin_left + 23 * mm, y, _safe(setting.address))

    phones = filter(None, [_safe(setting.phone), _safe(getattr(setting, 'mobile', ''))])
    for phone in phones:
        y -= 4.5 * mm
        c.setFont('Helvetica-Bold', 9)
        c.drawString(margin_left, y, 'Contact         :')
        c.setFont('Helvetica', 9)
        c.drawString(margin_left + 23 * mm, y, phone)

    # 2. META BOXES (Dated / Time / Invoice #)
    box_w = 38 * mm
    box_h = 10 * mm
    box_x = w - margin_right - box_w
    top_box_y = h - 28 * mm
    c.setLineWidth(0.6)

    # Extract date & time safely using local timezone logic
    created_dt = getattr(sale, 'created_at', None)
    if created_dt:
        if timezone.is_aware(created_dt):
            created_dt = timezone.localtime(created_dt)
        date_str = created_dt.strftime('%d-%b-%Y')
        time_str = created_dt.strftime('%I:%M %p')
    else:
        date_str = _safe(getattr(sale, 'date', ''))
        time_str = '-'

    c.rect(box_x, top_box_y, box_w, box_h)
    c.setFont('Helvetica', 8)
    c.drawCentredString(box_x + box_w / 2, top_box_y + 6 * mm, 'Dated')
    c.drawCentredString(box_x + box_w / 2, top_box_y + 2 * mm, date_str)

    top_box_y -= (box_h + 2 * mm)
    c.rect(box_x, top_box_y, box_w, box_h)
    c.drawCentredString(box_x + box_w / 2, top_box_y + 6 * mm, 'Time')
    c.drawCentredString(box_x + box_w / 2, top_box_y + 2 * mm, time_str)

    top_box_y -= (box_h + 2 * mm)
    c.rect(box_x, top_box_y, box_w, box_h)
    c.drawCentredString(box_x + box_w / 2, top_box_y + 6 * mm, 'Invoice #')
    c.drawCentredString(box_x + box_w / 2, top_box_y + 2 * mm, _safe(sale.invoice_no))

    # 3. TITLE & CUSTOMER BOX
    y = h - 68 * mm
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(w / 2, y, 'SALE INVOICE')

    y -= 14 * mm
    cust_box_h = 12 * mm
    c.rect(margin_left, y, printable_width, cust_box_h)

    customer = getattr(sale, 'customer', None)
    cust_name = customer.name if customer else 'Walk-in Customer'
    cust_phone = customer.phone if customer and customer.phone else ''
    cust_city = customer.city if customer and customer.city else ''
    cust_title = f"{cust_name} / {cust_phone}".strip(' /')

    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin_left + 3 * mm, y + 7 * mm, cust_title)
    if cust_city:
        c.drawString(margin_left + 3 * mm, y + 2.5 * mm, cust_city)

    # 4. ITEMS TABLE
    y -= 2 * mm
    col_widths = [12 * mm, 105 * mm, 20 * mm, 22 * mm, 22 * mm]
    headers = ['#', 'ITEM', 'QTY', 'PRICE', 'AMOUNT']

    table_top = y
    row_h = 7 * mm

    c.rect(margin_left, table_top - row_h, printable_width, row_h)
    cx = margin_left
    c.setFont('Helvetica-Bold', 9)

    for i, h_text in enumerate(headers):
        cw = col_widths[i]
        if i == 0:
            c.drawCentredString(cx + cw / 2, table_top - 5 * mm, h_text)
        elif i == 1:
            c.drawString(cx + 3 * mm, table_top - 5 * mm, h_text)
        else:
            c.drawCentredString(cx + cw / 2, table_top - 5 * mm, h_text)
        cx += cw

    items = list(sale.items.all())
    cur_y = table_top - row_h
    total_qty = Decimal('0')

    for idx, item in enumerate(items, 1):
        cur_y -= row_h
        c.rect(margin_left, cur_y, printable_width, row_h)
        cx = margin_left

        qty = _decimal(getattr(item, 'quantity', 0))
        price = _decimal(getattr(item, 'unit_price', 0))
        line_total = _decimal(getattr(item, 'line_total', qty * price))
        total_qty += qty

        vals = [
            str(idx),
            _safe(getattr(item, 'description', getattr(getattr(item, 'product', None), 'name', ''))),
            _qty_fmt(qty),
            _money_fmt(price),
            _money_fmt(line_total)
        ]

        c.setFont('Helvetica', 9)
        for i, val in enumerate(vals):
            cw = col_widths[i]
            if i == 0:
                c.drawCentredString(cx + cw / 2, cur_y + 2 * mm, val)
            elif i == 1:
                c.drawString(cx + 3 * mm, cur_y + 2 * mm, val)
            elif i == 2:
                c.drawCentredString(cx + cw / 2, cur_y + 2 * mm, val)
            else:
                c.drawRightString(cx + cw - 3 * mm, cur_y + 2 * mm, val)
            cx += cw

    # Total Item Summary Row
    cur_y -= row_h
    c.rect(margin_left, cur_y, printable_width, row_h)
    c.setFont('Helvetica-Bold', 9)
    c.drawRightString(margin_left + col_widths[0] + col_widths[1] - 3 * mm, cur_y + 2 * mm, 'Total Item(s) :')
    c.drawCentredString(margin_left + col_widths[0] + col_widths[1] + col_widths[2] / 2, cur_y + 2 * mm, _qty_fmt(total_qty))

    # 5. FINANCIAL BREAKDOWN & DYNAMIC URDU TERMS FROM SETTINGS
    footer_y = cur_y - 12 * mm
    fin_w = 80 * mm
    fin_x = w - margin_right - fin_w
    fin_row_h = 6.5 * mm

    amount = _decimal(getattr(sale, 'total', 0))
    prev_balance = _get_previous_balance(sale)
    paid = _get_total_paid(sale)
    balance = (amount + prev_balance) - paid

    fin_data = [
        ('Amount', _money_fmt(amount)),
        ('Prev Balance', _money_fmt(prev_balance)),
        ('Amount Paid', _money_fmt(paid)),
        ('Balance', _money_fmt(balance))
    ]

    for idx, (lbl, val) in enumerate(fin_data):
        fy = footer_y - (idx + 1) * fin_row_h
        c.rect(fin_x, fy, fin_w, fin_row_h)
        c.line(fin_x + fin_w - 30 * mm, fy, fin_x + fin_w - 30 * mm, fy + fin_row_h)
        c.setFont('Helvetica-Bold', 8.5)
        c.drawString(fin_x + 3 * mm, fy + 2 * mm, lbl)
        c.drawRightString(fin_x + fin_w - 3 * mm, fy + 2 * mm, val)

    # Fetch Terms dynamically from setting page
    terms_text = _safe(getattr(setting, 'terms', getattr(setting, 'terms_and_conditions', '')))
    if terms_text:
        _draw_wrapped_urdu(
            c=c,
            x=fin_x - 10 * mm,
            y_top=footer_y - 10 * mm,
            text=terms_text,
            width=fin_x - margin_left - 10 * mm,
            font_name=URDU_FONT_NAME,
            size=8.5,
            leading=12
        )

    c.showPage()
    c.save()
    return buf.getvalue()

def build_receipt_pdf(payment):
    setting = get_company_setting()
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    styles = getSampleStyleSheet()

    story = [
        Paragraph(setting.company_name or 'Company Name', styles['Title']),
        Paragraph('PAYMENT RECEIPT', styles['Heading2']),
        Spacer(1, 10)
    ]

    party = (
        payment.customer.name
        if getattr(payment, 'party_type', None) == 'CUSTOMER' and getattr(payment, 'customer', None)
        else payment.supplier.name
        if getattr(payment, 'supplier', None)
        else ''
    )

    rows = [
        ['Receipt No', getattr(payment, 'receipt_no', '-')],
        ['Date', str(getattr(payment, 'date', '-'))],
        ['Type', payment.get_party_type_display() if hasattr(payment, 'get_party_type_display') else '-'],
        ['Party', party],
        ['Amount', _money_fmt(getattr(payment, 'amount', 0))],
        ['Method', payment.get_payment_method_display() if hasattr(payment, 'get_payment_method_display') else '-'],
        ['Reference', getattr(payment, 'reference', None) or '-'],
        ['Notes', getattr(payment, 'notes', None) or '-']
    ]

    table = Table(rows, colWidths=[45*mm, 100*mm])
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.6, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F1F5F9')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 7)
    ]))

    story.append(table)
    story.append(Spacer(1, 24))
    story.append(Paragraph('Authorized Signature: ______________________________', styles['Normal']))

    doc.build(story)
    return buf.getvalue()