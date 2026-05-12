from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

from django.core.exceptions import ValidationError


# --- 1. USER & ROLES ---
class User(AbstractUser):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'), # 
        ('admin', 'Admin'), # 
        ('staff', 'Staff'), # 
        ('customer', 'Khách hàng'), # 
    )
    USER_TYPE_CHOICES = (
        ('individual', 'Cá nhân'), 
        ('enterprise', 'Doanh nghiệp')
    )
    # Các loại bảo hiểm staff phụ trách 
    STAFF_SPECIALIZATION = (
        ('property', 'Tài sản'),
        ('health', 'Sức khỏe'),
        ('vehicle', 'Xe'),
        ('marine', 'Hàng hải'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    phone = models.CharField(max_length=15, unique=True, null=True, blank=True) # Login Customer 
    address = models.TextField(null=True, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    # Info Cá nhân
    cccd = models.CharField(max_length=20, null=True, blank=True) 

    # Info Doanh nghiệp
    company_name = models.CharField(max_length=255, null=True, blank=True)
    tax_code = models.CharField(max_length=50, null=True, blank=True) # Bắt buộc nếu là DN 
    
    # Info Staff
    specialization = models.CharField(max_length=20, choices=STAFF_SPECIALIZATION, null=True, blank=True)
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, null=True, blank=True)

    def save(self, *args, **kwargs):
            # Logic: Internal user dùng email cty
            if self.role in ['admin', 'staff', 'super_admin']:
                if self.email and not self.email.endswith('@tisbroker.com'):
                    # SỬA LỖI: Thay lệnh pass bằng raise ValidationError
                    raise ValidationError("Nhân viên/Admin phải sử dụng email @tisbroker.com")
            super().save(*args, **kwargs)

class EnterpriseEmployee(models.Model):
    """Nhân viên do doanh nghiệp add vào để thụ hưởng bảo hiểm """
    enterprise = models.ForeignKey(User, on_delete=models.CASCADE, related_name='employees')
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

# --- 2. PRODUCTS & NEWS ---
class Category(models.Model):
    name = models.CharField(max_length=100) # Sức khỏe, Xe, v.v.
    slug = models.SlugField(unique=True)
    # Mapping với staff specialization
    specialization_code = models.CharField(max_length=20, choices=User.STAFF_SPECIALIZATION) 

class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    provider_name = models.CharField(max_length=255) # Tên đơn vị cung cấp (Sensitive) 
    short_description = models.TextField(blank=True, null=True) # Detail Base (chỉ text)
    description = models.TextField(blank=True, null=True)       # Detail Final (CKEditor)
    is_featured = models.BooleanField(default=False) # Sản phẩm nổi bật 
    is_price_hidden = models.BooleanField(default=False, verbose_name="Giá liên hệ")
    target_audience = models.CharField(max_length=10, choices=(('ind', 'Cá nhân'), ('ent', 'Doanh nghiệp')))
    created_at = models.DateTimeField(auto_now_add=True)


    @property
    def base_price(self):
        # Lấy giá của gói đầu tiên để trả về cho FE nhanh
        first_package = self.packages.first()
        return first_package.price if first_package else None

    @property
    def category_name(self):
        return self.category.name if self.category else "Chưa phân loại"

class ProductImage(models.Model):
    """Cho phép upload nhiều ảnh """
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='products/')

class ProductPackage(models.Model):
    """Gói thời hạn (6 tháng, 1 năm...) """
    product = models.ForeignKey(Product, related_name='packages', on_delete=models.CASCADE)
    duration_label = models.CharField(max_length=50) # "6 Tháng", "1 Năm"
    price = models.DecimalField(max_digits=15, decimal_places=0)
    duration_days = models.IntegerField(help_text="Số ngày hiệu lực")

class News(models.Model): # 
    title = models.CharField(max_length=255)
    image = models.ImageField(upload_to='news/')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

# --- 3. ORDER & CART ---
class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Chờ xác nhận'), # 
        ('confirmed', 'Đã xác nhận'), # Đang làm thủ tục
        ('active', 'Đang hiệu lực'), 
        ('cancelled', 'Hủy đơn'),
    )
    code = models.CharField(max_length=20, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=15, decimal_places=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Admin xử lý 
    processed_by = models.ForeignKey(User, related_name='processed_orders', null=True, blank=True, on_delete=models.SET_NULL)
    
    # Nếu là DN mua cho nhân viên 
    beneficiary_note = models.TextField(blank=True, help_text="Danh sách người thụ hưởng")

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    package = models.ForeignKey(ProductPackage, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    
class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    package = models.ForeignKey(ProductPackage, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)

# --- 4. CONSULTATION / CHAT ---
class ConsultationRequest(models.Model): # 
    # Auto assign staff based on category
    assigned_staff = models.ForeignKey(User, related_name='consultations', null=True, blank=True, on_delete=models.SET_NULL)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    customer_name = models.CharField(max_length=255)
    customer_contact = models.CharField(max_length=255)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # --- THÊM TRƯỜNG NÀY ---
    processor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_consultations')
    updated_at = models.DateTimeField(auto_now=True)
    guest_session_id = models.CharField(max_length=255, null=True, blank=True) # Lưu session ID của khách vãng lai để gắn với chat
    STATUS_CHOICES = (
        ('new', 'Mới'),
        ('processed', 'Đang xử lý'),
        ('done', 'Hoàn tất'),
        ('archived', 'Lưu trữ'), # Thêm trạng thái này
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')

    def __str__(self):
        return f"{self.customer_name} - {self.status}"





class ChatMessage(models.Model):
    # Định nghĩa các loại tệp đính kèm được hỗ trợ
    ATTACHMENT_TYPES = (
        ('image', 'Hình ảnh'),
        ('document', 'Tài liệu'),
        ('video', 'Video'),
        ('audio', 'Âm thanh'),
    )

    consultation = models.ForeignKey(
        'ConsultationRequest', 
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name="Yêu cầu tư vấn"
    )
    
    # Người gửi: Null nếu là khách vãng lai chưa có tài khoản
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_messages',
        verbose_name="Người gửi" 
    )

    # TRƯỜNG QUAN TRỌNG: Lưu tên của khách vãng lai (nếu sender = Null)
    guest_name = models.CharField(
        max_length=100, 
        null=True, 
        blank=True, 
        verbose_name="Tên khách vãng lai"
    )
    
    # Cho phép null/blank vì người dùng có thể chỉ gửi mỗi bức ảnh mà không có text
    message = models.TextField(
        blank=True, 
        null=True,
        verbose_name="Nội dung tin nhắn"
    )
    
    is_staff_reply = models.BooleanField(
        default=False,
        verbose_name="Là phản hồi của Admin/Staff"
    )

    # --- TỆP ĐÍNH KÈM ---
    attachment = models.FileField(
        upload_to='chat_attachments/%Y/%m/', # Tự động tạo thư mục theo năm/tháng
        blank=True,
        null=True,
        verbose_name="Tệp đính kèm"
    )
    
    is_read = models.BooleanField(
        default=False,
        verbose_name="Trạng thái đã xem"
    )

    # --- THỜI GIAN ---
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian gửi")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Thời gian cập nhật")

# THÊM 2 DÒNG NÀY VÀO DƯỚI CÙNG CỦA MODEL
    attachment_url = models.CharField(max_length=500, null=True, blank=True)
    attachment_type = models.CharField(
        max_length=50,
        choices=ATTACHMENT_TYPES,
        null=True,
        blank=True,
        verbose_name="Loại tệp đính kèm",
    )

    class Meta:
        # Sắp xếp mặc định theo thời gian tăng dần (Tin nhắn cũ ở trên, mới ở dưới)
        ordering = ['created_at'] 
        verbose_name = "Tin nhắn chat"
        verbose_name_plural = "Quản lý tin nhắn"

    def __str__(self):
        # Xử lý ưu tiên tên hiển thị: User đăng nhập -> Tên khách nhập -> Mặc định
        if self.sender:
            sender_name = f"{self.sender.last_name} {self.sender.first_name}".strip() or self.sender.username
        elif self.guest_name:
            sender_name = self.guest_name
        else:
            sender_name = "Khách vãng lai"

        # Nếu không có text (chỉ có ảnh), hiển thị preview là loại file
        if self.message:
            msg_preview = self.message[:30] + ('...' if len(self.message) > 30 else '')
        elif self.attachment:
            msg_preview = f"[{self.get_attachment_type_display()}]"
        else:
            msg_preview = "[Tin nhắn trống]"
            
        return f"[{self.created_at.strftime('%H:%M %d/%m')}] {sender_name}: {msg_preview}"
