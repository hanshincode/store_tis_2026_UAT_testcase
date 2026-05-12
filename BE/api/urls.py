from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, 
    ProductViewSet, 
    OrderViewSet, 
    NewsViewSet, 
    ConsultationRequestViewSet, 
    DashboardSummaryView,
    EmployeeViewSet,
    CartViewSet,
    CategoryViewSet
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from django.urls import path
from . import views

router = DefaultRouter()

# --- ĐĂNG KÝ ROUTER ---
router.register(r'users', UserViewSet, basename='users')
router.register(r'products', ProductViewSet) # ProductViewSet có queryset nên không cần basename

# [QUAN TRỌNG] Thêm basename='orders' để sửa lỗi AssertionError
router.register(r'orders', OrderViewSet, basename='orders') 

router.register(r'news', NewsViewSet)
router.register(r'consultations', ConsultationRequestViewSet, basename='consultations')
router.register(r'employees', EmployeeViewSet, basename='employees')
router.register(r'cart', CartViewSet, basename='cart')
router.register(r'categories', CategoryViewSet)


urlpatterns = [
    path('', include(router.urls)),
    
    path('register/', UserViewSet.as_view({'post': 'create'}), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    path('auth/social/', include('allauth.socialaccount.urls')),
    
    path('consultations/<int:pk>/', views.update_consultation_status, name='update-consultation'),
]
