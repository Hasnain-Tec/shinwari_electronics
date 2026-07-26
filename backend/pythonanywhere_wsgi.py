# PythonAnywhere WSGI Configuration for username: shinwari
# Website URL: shinwari.pythonanywhere.com

import os
import sys

# Add your backend project directory to sys.path
path = '/home/shinwari/shinwari_electronics/backend'
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variables if needed
os.environ['DJANGO_SETTINGS_MODULE'] = 'medtrade.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
