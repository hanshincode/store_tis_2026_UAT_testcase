from django.contrib import admin
from .models import (
    User, Product, Category, ProductImage, ProductPackage, 
    Order, OrderItem, News, EnterpriseEmployee, 
    ConsultationRequest, ChatMessage
)

# Config hiển thị User
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'phone', 'is_active')
    list_filter = ('role', 'user_type', 'is_staff')
    search_fields = ('username', 'email', 'phone')

# Config hiển thị Sản phẩm (cho phép add ảnh và gói trực tiếp)
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

class ProductPackageInline(admin.TabularInline):
    model = ProductPackage
    extra = 1

class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'provider_name', 'base_price_display', 'is_featured')
    list_filter = ('category', 'is_featured', 'target_audience')
    search_fields = ('name', 'provider_name')
    inlines = [ProductImageInline, ProductPackageInline]

    def base_price_display(self, obj):
        # Hiển thị giá của gói đầu tiên làm mẫu
        first_pkg = obj.packages.first()
        return f"{first_pkg.price:,.0f} VND" if first_pkg else "N/A"

# Config Order
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('package', 'quantity')

class OrderAdmin(admin.ModelAdmin):
    list_display = ('code', 'user', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('code', 'user__username')
    inlines = [OrderItemInline]
    readonly_fields = ('total_amount', 'code', 'user')

# Đăng ký các model
admin.site.register(User, UserAdmin)
admin.site.register(Category)
admin.site.register(Product, ProductAdmin)
admin.site.register(News)
admin.site.register(Order, OrderAdmin)
admin.site.register(EnterpriseEmployee)
admin.site.register(ConsultationRequest)
admin.site.register(ChatMessage)