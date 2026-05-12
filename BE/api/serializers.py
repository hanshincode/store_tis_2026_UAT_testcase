from rest_framework import serializers
from django.utils.html import strip_tags
from .models import (
    User, Product, ProductImage, ProductPackage, 
    Order, OrderItem, EnterpriseEmployee, ChatMessage,
    CartItem, ConsultationRequest, News, Category
)

# --- 1. USER & AUTH SERIALIZERS ---
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'phone', 'password', 'role', 'user_type',
            'company_name', 'tax_code', 'cccd', 'address', 
            'first_name', 'last_name', 'email'
        ]

    def validate_role(self, value):
        request = self.context.get('request')
        is_internal_admin = (
            request
            and request.user.is_authenticated
            and request.user.role in ['super_admin', 'admin']
        )
        return value if is_internal_admin else 'customer'

    def create(self, validated_data):
        if 'username' not in validated_data and 'phone' in validated_data:
            validated_data['username'] = validated_data['phone']
        user = User.objects.create_user(**validated_data)
        return user

class EnterpriseEmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnterpriseEmployee
        fields = '__all__'
        read_only_fields = ['enterprise']

# --- 2. PRODUCT SERIALIZERS ---
class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image'] # Thêm ID để FE biết mà gửi lệnh xóa

class ProductPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPackage
        fields = ['id', 'duration_label', 'price', 'duration_days']

class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    packages = ProductPackageSerializer(many=True, read_only=True)
    
    # 1. Hiển thị tên danh mục (Fix lỗi N/A)
    category_name = serializers.ReadOnlyField()

    # 2. Xử lý giá (Base Price) - Field ảo không có trong Model Product
    base_price = serializers.DecimalField(max_digits=15, decimal_places=0, required=False, allow_null=True)

    # 3. Upload ảnh mới (List các file ảnh)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )

    # 4. Xóa ảnh cũ (List các ID ảnh cần xóa)
    deleted_image_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Product
        fields = '__all__'

    def validate_short_description(self, value):
        """Đảm bảo Detail Base chỉ chứa text thuần, loại bỏ HTML tags"""
        if value:
            return strip_tags(value)
        return value

    def create(self, validated_data):
        # Tách các dữ liệu không thuộc bảng Product
        price = validated_data.pop('base_price', None)
        uploaded_images = validated_data.pop('uploaded_images', [])
        
        # Lưu Product
        product = super().create(validated_data)

        # Xử lý GIÁ: Nếu có nhập giá, tạo gói mặc định 1 năm
        if price and price > 0 and not product.is_price_hidden:
            ProductPackage.objects.create(
                product=product,
                duration_label="1 Năm",
                duration_days=365,
                price=price
            )
        
        # Xử lý ẢNH: Lưu từng ảnh vào bảng ProductImage
        for image in uploaded_images:
            ProductImage.objects.create(product=product, image=image)

        return product

    def update(self, instance, validated_data):
        price = validated_data.pop('base_price', None)
        uploaded_images = validated_data.pop('uploaded_images', [])
        deleted_ids = validated_data.pop('deleted_image_ids', []) # Lấy danh sách ID cần xóa
        
        # Cập nhật thông tin Product
        instance = super().update(instance, validated_data)

        # Xử lý XÓA ẢNH CŨ
        if deleted_ids:
            # Chỉ xóa ảnh nếu nó thuộc về sản phẩm này (để bảo mật)
            ProductImage.objects.filter(id__in=deleted_ids, product=instance).delete()

        # Xử lý CẬP NHẬT GIÁ
        if price is not None and not instance.is_price_hidden:
            package = instance.packages.first()
            if package:
                package.price = price
                package.save()
            else:
                # Nếu chưa có gói nào thì tạo mới
                ProductPackage.objects.create(
                    product=instance,
                    duration_label="1 Năm",
                    duration_days=365,
                    price=price
                )
        
        # Xử lý THÊM ẢNH MỚI
        for image in uploaded_images:
            ProductImage.objects.create(product=instance, image=image)

        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # Ẩn tên nhà cung cấp nếu user không phải Admin
        is_admin = request and request.user.is_authenticated and request.user.role in ['admin', 'super_admin']
        if not is_admin:
            data.pop('provider_name', None)
        return data

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        extra_kwargs = {'slug': {'required': False}}

    def create(self, validated_data):
        if 'name' in validated_data and 'slug' not in validated_data:
            from django.utils.text import slugify
            validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)

# --- 3. CART & ORDER SERIALIZERS ---
from rest_framework import serializers
from .models import CartItem

class CartItemSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package.duration_label', read_only=True)
    product_name = serializers.CharField(source='package.product.name', read_only=True)
    price = serializers.DecimalField(source='package.price', max_digits=15, decimal_places=0, read_only=True)
    image = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ['id', 'package', 'package_name', 'product_name', 'price', 'quantity', 'subtotal', 'image']

    def get_image(self, obj):
        # Lấy ảnh đầu tiên của sản phẩm trong album
        first_image = obj.package.product.images.first()
        if first_image and first_image.image:
            return first_image.image.url
        return None

    def get_subtotal(self, obj):
        return obj.package.price * obj.quantity
    
    
    
class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='package.product.name', read_only=True)
    duration = serializers.CharField(source='package.duration_label', read_only=True)
    price = serializers.DecimalField(source='package.price', max_digits=15, decimal_places=0, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['product_name', 'duration', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = '__all__'

# --- 4. CHAT & NEWS SERIALIZERS ---
# backend/api/serializers.py

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%H:%M %d/%m", read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'consultation', 'sender', 'message', 
            'is_staff_reply', 'created_at', 'sender_name', 
            'avatar', 'attachment_url', 'attachment_type'
        ]

    def get_sender_name(self, obj):
        if obj.sender:
            return f"{obj.sender.last_name} {obj.sender.first_name}".strip() or obj.sender.username
        return obj.guest_name or "Khách hàng"

    def get_avatar(self, obj):
        # Trả về avatar của người gửi (Staff hoặc User có tài khoản)
        if obj.sender and obj.sender.avatar:
            return obj.sender.avatar.url
        return None

class ConsultationRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_at_formatted = serializers.DateTimeField(source='created_at', format="%d/%m/%Y %H:%M", read_only=True)
    processor_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationRequest
        fields = '__all__'

    def get_processor_name(self, obj):
        if obj.processor:
            return f"{obj.processor.last_name} {obj.processor.first_name}".strip()
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.last()
        if last_msg:
            # Nếu tin nhắn trống nhưng có file đính kèm
            content = last_msg.message
            if not content and (last_msg.attachment or last_msg.attachment_url):
                content = "[Tệp đính kèm]"
            
            return {
                "message": content,
                "time": last_msg.created_at.strftime("%H:%M"),
                "is_staff": last_msg.is_staff_reply
            }
        return None
class NewsSerializer(serializers.ModelSerializer):
    class Meta:
        model = News
        fields = '__all__'


# Thêm vào backend/api/serializers.py
# backend/api/serializers.py

# Thêm vào vị trí thích hợp (ví dụ ngay sau RegisterSerializer)
class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'first_name', 'last_name',
            'full_name', 'avatar', 'is_superuser', 'is_staff', 'is_active',
            'phone', 'user_type', 'company_name'
        ]
        read_only_fields = ['id', 'username', 'role', 'is_superuser', 'is_staff', 'is_active']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
