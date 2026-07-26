from io import BytesIO
from decimal import Decimal
from textwrap import wrap

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet

from .utils import get_company_setting


DARK = colors.HexColor('#111827')
GRID = colors.HexColor('#374151')
MUTED = colors.HexColor('#4B5563')
ACCENT = colors.HexColor('#E11D48')
LIGHT = colors.HexColor('#F8FAFC')


def _decimal(value):
    try:
        return Decimal(value or 0)
    except Exception:
        return Decimal('0')


def _money(value, setting, with_symbol=True):
    value = _decimal(value)
    number = f'{value:,.2f}'
    return f'{setting.currency_symbol} {number}' if with_symbol else number


def _qty(value):
    value = _decimal(value)
    # Display 3 decimals only when necessary.
    s = f'{value:,.3f}'
    return s.rstrip('0').rstrip('.') if '.' in s else s


def _safe(value):
    return str(value or '').strip()


def _draw_text(c, x, y, text, size=8, bold=False, color=DARK, max_width=None, align='left'):
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.setFillColor(color)
    text = _safe(text)
    if max_width:
        while text and c.stringWidth(text, font, size) > max_width:
            text = text[:-1]
        if text != _safe(value := text):
            pass
    if align == 'right':
        c.drawRightString(x, y, text)
    elif align == 'center':
        c.drawCentredString(x, y, text)
    else:
        c.drawString(x, y, text)


def _fit_text(c, text, max_width, font='Helvetica', size=8):
    text = _safe(text)
    if c.stringWidth(text, font, size) <= max_width:
        return text
    ellipsis = '...'
    while text and c.stringWidth(text + ellipsis, font, size) > max_width:
        text = text[:-1]
    return text + ellipsis


def _draw_wrapped(c, x, y_top, text, width, size=8, leading=10, bold=False, max_lines=4):
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.setFillColor(DARK)
    words = _safe(text).split()
    lines = []
    line = ''
    for word in words:
        candidate = f'{line} {word}'.strip()
        if c.stringWidth(candidate, font, size) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    if not lines:
        lines = ['']
    lines = lines[:max_lines]
    for idx, line in enumerate(lines):
        c.drawString(x, y_top - idx * leading, line)
    return len(lines) * leading


def _draw_label_value(c, x, y, label, value, label_width=28*mm, size=8):
    c.setFont('Helvetica-Bold', size)
    c.setFillColor(DARK)
    c.drawString(x, y, label)
    c.setFont('Helvetica', size)
    c.drawString(x + label_width, y, _safe(value))


def _draw_header(c, setting, page_no=1, total_pages=1):
    w, h = A4
    top = h - 13*mm
    company = _safe(setting.company_name) or 'MEDTRADE INVENTORY'
    c.setFillColor(ACCENT)
    header_text = company.upper()
    header_size = 15.0
    while header_size > 9.5 and c.stringWidth(header_text, 'Helvetica-Bold', header_size) > w - 18*mm:
        header_size -= 0.5
    c.setFont('Helvetica-Bold', header_size)
    c.drawCentredString(w/2, top, header_text)

    y = top - 6*mm
    c.setFillColor(DARK)
    c.setFont('Helvetica', 8)
    if setting.address:
        c.drawCentredString(w/2, y, _fit_text(c, setting.address, 175*mm, size=8))
        y -= 4.3*mm
    contacts = '  |  '.join(filter(None, [
        f'Email: {setting.email}' if setting.email else '',
        f'Mob: {setting.phone}' if setting.phone else '',
    ]))
    if contacts:
        c.drawCentredString(w/2, y, contacts)
        y -= 4.3*mm
    if setting.trn:
        c.setFont('Helvetica-Bold', 8)
        c.drawCentredString(w/2, y, f'TRN: {setting.trn}')
        y -= 5*mm
    if total_pages > 1:
        c.setFont('Helvetica', 7)
        c.setFillColor(MUTED)
        c.drawRightString(w - 10*mm, h - 8*mm, f'Page {page_no} of {total_pages}')
    return y


def _draw_info_boxes(c, sale, y_top):
    w, _ = A4
    margin = 7*mm
    gap = 4*mm
    box_w = (w - 2*margin - gap) / 2
    box_h = 31*mm
    left_x = margin
    right_x = left_x + box_w + gap
    y = y_top - box_h

    for x in (left_x, right_x):
        c.setStrokeColor(GRID)
        c.setLineWidth(0.7)
        c.roundRect(x, y, box_w, box_h, 2.5*mm, stroke=1, fill=0)
        c.line(x, y + box_h - 7*mm, x + box_w, y + box_h - 7*mm)

    c.setFont('Helvetica-Bold', 8.5)
    c.setFillColor(DARK)
    c.drawCentredString(left_x + box_w/2, y + box_h - 5*mm, 'CUSTOMER')
    c.drawCentredString(right_x + box_w/2, y + box_h - 5*mm, 'TAX INVOICE')

    customer = sale.customer
    cy = y + box_h - 12*mm
    if customer:
        _draw_label_value(c, left_x + 4*mm, cy, 'Customer', customer.name, 20*mm)
        cy -= 4.7*mm
        _draw_label_value(c, left_x + 4*mm, cy, 'Phone', customer.phone, 20*mm)
        cy -= 4.7*mm
        address = ' '.join(filter(None, [customer.address, customer.city, customer.country]))
        _draw_label_value(c, left_x + 4*mm, cy, 'Address', _fit_text(c, address, box_w-29*mm, size=8), 20*mm)
        cy -= 4.7*mm
        _draw_label_value(c, left_x + 4*mm, cy, 'TRN', customer.trn, 20*mm)
    else:
        _draw_label_value(c, left_x + 4*mm, cy, 'Customer', 'Walk-in Customer', 20*mm)

    ry = y + box_h - 12*mm
    _draw_label_value(c, right_x + 4*mm, ry, 'INVOICE NO', sale.invoice_no, 26*mm, 8)
    ry -= 4.7*mm
    _draw_label_value(c, right_x + 4*mm, ry, 'Invoice Date', sale.date, 26*mm, 8)
    ry -= 4.7*mm
    _draw_label_value(c, right_x + 4*mm, ry, 'Pay Mode', sale.get_payment_mode_display(), 26*mm, 8)
    ry -= 4.7*mm
    salesperson = ''
    if sale.salesperson:
        salesperson = sale.salesperson.get_full_name().strip() or sale.salesperson.username
    _draw_label_value(c, right_x + 4*mm, ry, 'Salesperson', salesperson, 26*mm, 8)
    return y - 6*mm


def _table_columns():
    # Total width 196 mm (A4 - 14 mm margins).
    return [11, 53, 12, 19, 17, 24, 13, 21, 26]


def _draw_items_table(c, items, y_top, max_rows, continued=False):
    margin = 7*mm
    widths_mm = _table_columns()
    widths = [x*mm for x in widths_mm]
    x_positions = [margin]
    for width in widths:
        x_positions.append(x_positions[-1] + width)

    header_h = 12*mm
    row_h = 6.4*mm
    table_h = header_h + max_rows*row_h
    bottom = y_top - table_h

    c.setStrokeColor(GRID)
    c.setLineWidth(0.55)
    c.rect(margin, bottom, sum(widths), table_h, stroke=1, fill=0)
    for x in x_positions[1:-1]:
        c.line(x, bottom, x, y_top)
    c.line(margin, y_top-header_h, margin+sum(widths), y_top-header_h)
    for row in range(1, max_rows):
        yy = y_top-header_h-row*row_h
        c.setStrokeColor(colors.HexColor('#D1D5DB'))
        c.setLineWidth(0.3)
        c.line(margin, yy, margin+sum(widths), yy)

    headers = [
        ('Item No', 6.3), ('Description', 6.3), ('Qty', 6.3), ('Unit Price', 6.3),
        ('Discount', 6.3), ('Taxable Amount', 6.0), ('VAT Rate', 6.0),
        ('VAT Amount', 6.0), ('Total with VAT', 6.0),
    ]
    for idx, (label, size) in enumerate(headers):
        x0, x1 = x_positions[idx], x_positions[idx+1]
        c.setFont('Helvetica-Bold', size)
        c.setFillColor(DARK)
        if ' ' in label:
            parts = label.split(' ', 1)
            c.drawCentredString((x0+x1)/2, y_top-4.6*mm, parts[0])
            c.drawCentredString((x0+x1)/2, y_top-8.1*mm, parts[1])
        else:
            c.drawCentredString((x0+x1)/2, y_top-6.4*mm, label)

    setting = get_company_setting()
    for row_idx in range(max_rows):
        y_mid = y_top - header_h - row_idx*row_h - row_h/2 - 1.1*mm
        if row_idx >= len(items):
            continue
        item_no, item = items[row_idx]
        taxable = _decimal(item.quantity) * _decimal(item.unit_price) - _decimal(item.discount)
        values = [
            str(item_no),
            _safe(item.description),
            _qty(item.quantity),
            _money(item.unit_price, setting, False),
            _money(item.discount, setting, False),
            _money(taxable, setting, False),
            f'{_qty(item.vat_rate)}%',
            _money(item.vat_amount, setting, False),
            _money(item.line_total, setting, False),
        ]
        for col, value in enumerate(values):
            x0, x1 = x_positions[col], x_positions[col+1]
            c.setFont('Helvetica', 7)
            c.setFillColor(DARK)
            if col == 1:
                value = _fit_text(c, value, x1-x0-3*mm, size=7)
                c.drawCentredString((x0+x1)/2, y_mid, value)
            elif col == 0:
                c.drawCentredString((x0+x1)/2, y_mid, value)
            else:
                c.drawRightString(x1-1.5*mm, y_mid, value)

    return bottom, row_h


def _draw_last_page_footer(c, sale, y_top, table_bottom, setting):
    w, _ = A4
    margin = 7*mm
    total_w = 91*mm
    left_w = 105*mm
    footer_top = min(table_bottom - 1*mm, y_top)
    footer_h = 39*mm
    footer_bottom = footer_top - footer_h

    # Terms/remarks block and totals block.
    c.setStrokeColor(GRID)
    c.setLineWidth(0.6)
    c.rect(margin, footer_bottom, left_w, footer_h, stroke=1, fill=0)
    c.rect(margin+left_w, footer_bottom, total_w, footer_h, stroke=1, fill=0)

    c.setFont('Helvetica-Bold', 7.5)
    c.setFillColor(DARK)
    c.drawString(margin+1.5*mm, footer_top-4*mm, 'Terms & Conditions')
    terms = _safe(setting.terms)
    if terms:
        _draw_wrapped(c, margin+1.5*mm, footer_top-8.5*mm, terms, left_w-3*mm, size=7, leading=3.6*mm, max_lines=5)
    if sale.notes:
        c.setFont('Helvetica-Bold', 7.2)
        c.drawString(margin+1.5*mm, footer_bottom+6.2*mm, 'Remark')
        c.setFont('Helvetica', 7)
        c.drawString(margin+19*mm, footer_bottom+6.2*mm, _fit_text(c, sale.notes, left_w-22*mm, size=7))

    rows = [
        ('Sub Total', sale.subtotal),
        ('Discount', sale.discount_total),
        ('Gross Total', _decimal(sale.subtotal)-_decimal(sale.discount_total)),
        ('VAT Total', sale.vat_total),
        ('Invoice Total', sale.total),
    ]
    row_h = footer_h / len(rows)
    tx = margin + left_w
    for idx, (label, value) in enumerate(rows):
        y0 = footer_top - (idx+1)*row_h
        if idx:
            c.line(tx, footer_top-idx*row_h, tx+total_w, footer_top-idx*row_h)
        c.line(tx+52*mm, y0, tx+52*mm, y0+row_h)
        c.setFont('Helvetica-Bold' if label == 'Invoice Total' else 'Helvetica-Bold', 7.5)
        c.drawString(tx+1.7*mm, y0+row_h/2-1.3*mm, label)
        c.setFont('Helvetica-Bold' if label == 'Invoice Total' else 'Helvetica', 8)
        c.drawRightString(tx+total_w-2*mm, y0+row_h/2-1.3*mm, _money(value, setting, False))

    # Receiver details and prepared by.
    y = footer_bottom - 8*mm
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(margin+4*mm, y, 'Receiver Details')
    c.line(margin+4*mm, y-1.5*mm, margin+39*mm, y-1.5*mm)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(margin+4*mm, y-9*mm, 'Name')
    c.line(margin+16*mm, y-9.5*mm, margin+52*mm, y-9.5*mm)
    c.drawString(margin+4*mm, y-16*mm, 'Sign')
    c.line(margin+16*mm, y-16.5*mm, margin+52*mm, y-16.5*mm)

    prepared = ''
    if sale.salesperson:
        prepared = sale.salesperson.get_full_name().strip() or sale.salesperson.username
    c.setFont('Helvetica', 7.5)
    c.drawString(w/2+2*mm, y-5*mm, f'Prepared by: {prepared}')
    c.line(w/2+2*mm, y-7*mm, w-10*mm, y-7*mm)

    # Bank details block.
    bank_top = y - 24*mm
    bank_h = 24*mm
    c.roundRect(margin, bank_top-bank_h, w-2*margin, bank_h, 1.5*mm, stroke=1, fill=0)
    rows = [
        ('Account Title', setting.account_title),
        ('BANK NAME', setting.bank_name),
        ('Account Number', setting.account_number),
        ('IBAN', setting.iban),
    ]
    yy = bank_top - 5*mm
    for label, value in rows:
        c.setFont('Helvetica-Bold', 7.2)
        c.drawString(margin+1.5*mm, yy, label)
        c.setFont('Helvetica', 7.2)
        c.drawString(margin+39*mm, yy, ': ' + _fit_text(c, value, w-2*margin-42*mm, size=7.2))
        yy -= 4.5*mm


def build_invoice_pdf(sale):
    """Generate an English-only invoice closely following the provided sample layout.

    The document is data-driven, uses the configured company/currency/bank fields,
    and continues onto additional pages when the invoice has many items.
    """
    setting = get_company_setting()
    all_items = list(sale.items.all())
    first_page_rows = 14
    continuation_rows = 24

    chunks = []
    if len(all_items) <= first_page_rows:
        chunks = [all_items]
    else:
        chunks = [all_items[:first_page_rows]]
        remaining = all_items[first_page_rows:]
        while remaining:
            chunks.append(remaining[:continuation_rows])
            remaining = remaining[continuation_rows:]

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    total_pages = len(chunks)
    global_index = 1

    for page_idx, chunk in enumerate(chunks, 1):
        y = _draw_header(c, setting, page_idx, total_pages)
        if page_idx == 1:
            y = _draw_info_boxes(c, sale, y)
            max_rows = first_page_rows
        else:
            c.setFont('Helvetica-Bold', 10)
            c.setFillColor(DARK)
            c.drawString(7*mm, y-2*mm, f'Invoice {sale.invoice_no} - Continued')
            y -= 7*mm
            max_rows = continuation_rows

        numbered = []
        for item in chunk:
            numbered.append((global_index, item))
            global_index += 1
        table_bottom, _ = _draw_items_table(c, numbered, y, max_rows, continued=page_idx>1)

        if page_idx == total_pages:
            _draw_last_page_footer(c, sale, table_bottom-1*mm, table_bottom, setting)
        else:
            c.setFont('Helvetica-Oblique', 7.5)
            c.setFillColor(MUTED)
            c.drawRightString(A4[0]-7*mm, 10*mm, 'Continued on next page...')

        c.showPage()

    c.save()
    return buf.getvalue()


def build_receipt_pdf(payment):
    setting = get_company_setting()
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story = [Paragraph(setting.company_name, styles['Title']), Paragraph('PAYMENT RECEIPT', styles['Heading2']), Spacer(1, 10)]
    party = payment.customer.name if payment.party_type == 'CUSTOMER' and payment.customer else payment.supplier.name if payment.supplier else ''
    rows = [
        ['Receipt No', payment.receipt_no], ['Date', str(payment.date)], ['Type', payment.get_party_type_display()], ['Party', party],
        ['Amount', _money(payment.amount, setting)], ['Method', payment.get_payment_method_display()], ['Reference', payment.reference or '-'], ['Notes', payment.notes or '-']
    ]
    table = Table(rows, colWidths=[45*mm, 100*mm])
    table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.6,colors.HexColor('#CBD5E1')),('BACKGROUND',(0,0),(0,-1),colors.HexColor('#F1F5F9')),('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('PADDING',(0,0),(-1,-1),7)]))
    story.append(table)
    story.append(Spacer(1, 24))
    story.append(Paragraph('Authorized Signature: ______________________________', styles['Normal']))
    doc.build(story)
    return buf.getvalue()
