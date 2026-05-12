from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
   openapi.Info(
      title="TIS Insurance API",
      default_version='v1',
      description="API cho hệ thống bán bảo hiểm Online",
      contact=openapi.Contact(email="admin@tisbroker.com"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/', include('api.urls')),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/chat/', include('chat.urls')),
]
from django.conf import settings # Thêm dòng này
from django.conf.urls.static import static # Thêm dòng này

# Thêm dòng này để Django phục vụ file media khi DEBUG = True
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
