from django.conf import settings
from django.contrib import admin
from django.http import FileResponse
from django.urls import include, path, re_path
from django.views.static import serve


def react_index(request):
    index_file = settings.FRONTEND_DIST / "index.html"

    return FileResponse(
        open(index_file, "rb"),
        content_type="text/html",
    )


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/", include("core.urls")),

    re_path(
        r"^assets/(?P<path>.*)$",
        serve,
        {
            "document_root": settings.FRONTEND_ASSETS,
        },
    ),

    re_path(
        r"^(?!api/|admin/|assets/).*$",
        react_index,
    ),
]