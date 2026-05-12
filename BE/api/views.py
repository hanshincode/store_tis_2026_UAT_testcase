# backend/api/views.py

import time
import uuid
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters, mixins
from rest_framework.decorators import action, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

# Import Models
from .models import (
    Product, ProductImage, ProductPackage, Category,
    Order, OrderItem, News, User, EnterpriseEmployee, 
    ConsultationRequest, Cart, CartItem
)

# Import Serializers
from .serializers import (
    ProductSerializer, CategorySerializer, OrderSerializer, 
    EnterpriseEmployeeSerializer, RegisterSerializer, 
    CartItemSerializer, OrderItemSerializer,
    ProductPackageSerializer, ConsultationRequestSerializer, NewsSerializer,
    UserSerializer
)

# --- PHÂN QUYỀN TÙY CHỈNH (INTERNAL) ---

class IsTISAdminOrStaff(permissions.BasePermission):
    """
    Quyền truy cập dành cho cấp quản trị dựa trên trường 'role' trong Model User.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and \
               (request.user.is_superuser or request.user.is_staff or request.user.role in ['super_admin', 'admin', 'staff'])


def make_order_code():
    return f"ORD-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}"


def parse_positive_int(value, default=1, field_name="quantity"):
    try:
        number = int(value if value is not None else default)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} không hợp lệ")
    if number <= 0:
        raise ValueError(f"{field_name} phải lớn hơn 0")
    return number

# --- AUTH VIEWSETS ---

class RegisterView(viewsets.GenericViewSet, mixins.CreateModelMixin):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class UserViewSet(viewsets.ModelViewSet):
    """Quản lý thông tin người dùng và lấy dữ liệu cá nhân (me)"""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def get_permissions(self):
        if self.action == 'create' or (self.action == 'messages' and self.request.method == 'GET'):
            return [permissions.AllowAny()]
        if self.action in ['me', 'set_password']:
            return [permissions.IsAuthenticated()]
        return [IsTISAdminOrStaff()]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return User.objects.none()
        return User.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return RegisterSerializer
        return UserSerializer # Serializer đầy đủ thông tin

    @action(detail=False, methods=['get'])
    def me(self, request):
        # Đảm bảo dùng UserSerializer ở đây
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='staff-list')
    def staff_list(self, request):
        users = User.objects.filter(role__in=['super_admin', 'admin', 'staff']).order_by('role', 'username')
        return Response(UserSerializer(users, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='create-staff')
    def create_staff(self, request):
        if not (request.user.is_superuser or request.user.role in ['super_admin', 'admin']):
            return Response({"detail": "Bạn không có quyền tạo nhân sự."}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip()
        email = (request.data.get('email') or '').strip()
        role = request.data.get('role') if request.data.get('role') in ['admin', 'staff'] else 'staff'

        if not username or not password:
            return Response({"detail": "Vui lòng nhập tài khoản và mật khẩu."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Tài khoản đã tồn tại."}, status=status.HTTP_400_BAD_REQUEST)

        name_parts = full_name.split(maxsplit=1)
        first_name = name_parts[-1] if name_parts else ''
        last_name = name_parts[0] if len(name_parts) > 1 else ''

        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role,
                is_staff=True,
            )
        except DjangoValidationError as exc:
            return Response({"detail": "; ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        if not (request.user.is_superuser or request.user.role in ['super_admin', 'admin']):
            return Response({"detail": "Bạn không có quyền cập nhật trạng thái nhân sự."}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        if user.id == request.user.id:
            return Response({"detail": "Không thể tự khóa tài khoản đang đăng nhập."}, status=status.HTTP_400_BAD_REQUEST)
        if user.role not in ['super_admin', 'admin', 'staff'] and not user.is_staff:
            return Response({"detail": "Chỉ được cập nhật tài khoản nhân sự."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='set_password')
    def set_password(self, request):
        current_password = request.data.get('current_password') or ''
        new_password = request.data.get('new_password') or ''

        if not request.user.check_password(current_password):
            return Response({"current_password": ["Mật khẩu hiện tại không đúng."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, request.user)
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({"detail": "Đổi mật khẩu thành công."})

# --- BUSINESS VIEWSETS ---

class CategoryViewSet(viewsets.ModelViewSet):
    """Quản lý danh mục bảo hiểm"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        # Chấp nhận Admin/Super Admin/Staff thực hiện ghi dữ liệu
        return [IsTISAdminOrStaff()]

class ProductViewSet(viewsets.ModelViewSet):
    """Quản lý sản phẩm, giá phí và album ảnh"""
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'category__name', 'provider_name']
    


    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsTISAdminOrStaff()]

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Lấy danh sách sản phẩm nổi bật"""
        products = self.queryset.filter(is_featured=True)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['delete'])
    def delete_image(self, request, pk=None):
        """Xóa lẻ một tấm ảnh trong album"""
        image_id = request.data.get('image_id')
        try:
            img = ProductImage.objects.get(id=image_id, product_id=pk)
            img.delete()
            return Response({"message": "Đã xóa ảnh thành công"}, status=status.HTTP_204_NO_CONTENT)
        except ProductImage.DoesNotExist:
            return Response({"error": "Ảnh không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

class OrderViewSet(viewsets.ModelViewSet):
    """Quản lý đơn hàng"""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none() # Trả về list rỗng cho Swagger
    
        user = self.request.user
        if user.role in ['admin', 'super_admin']:
            return Order.objects.all()
        return Order.objects.filter(user=user)

    @action(detail=False, methods=['post'])
    def buy_now(self, request):
        package_id = request.data.get('package_id')
        
        try:
            quantity = parse_positive_int(request.data.get('quantity', 1))
            package = ProductPackage.objects.get(id=package_id)
            total = package.price * quantity
            order_code = make_order_code()
            
            order = Order.objects.create(
                user=request.user,
                total_amount=total,
                status='pending',
                code=order_code
            )
            OrderItem.objects.create(order=order, package=package, quantity=quantity)
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        except (ValueError, ProductPackage.DoesNotExist) as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def checkout_cart(self, request):
        try:
            cart = Cart.objects.get(user=request.user)
            items = cart.items.all()
            
            if not items.exists():
                return Response({"error": "Giỏ hàng đang trống"}, status=status.HTTP_400_BAD_REQUEST)

            total_amount = sum(item.package.price * item.quantity for item in items)
            order_code = make_order_code()
            
            with transaction.atomic():
                order = Order.objects.create(
                    user=request.user,
                    total_amount=total_amount,
                    status='pending',
                    code=order_code
                )
                
                # Chuyển CartItem thành OrderItem
                for item in items:
                    OrderItem.objects.create(
                        order=order, 
                        package=item.package, 
                        quantity=item.quantity
                    )
                
                # Xóa sạch giỏ hàng sau khi tạo đơn
                items.delete()

            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        except Cart.DoesNotExist:
            return Response({"error": "Không tìm thấy giỏ hàng"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)




class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EnterpriseEmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 1. Bỏ qua nếu là fake view của Swagger
        if getattr(self, 'swagger_fake_view', False):
            return EnterpriseEmployee.objects.none()

        # 2. Đảm bảo user đã đăng nhập
        if not self.request.user.is_authenticated:
            return EnterpriseEmployee.objects.none()

        # Code cũ của bạn
        return EnterpriseEmployee.objects.filter(enterprise=self.request.user)

    def perform_create(self, serializer):
        serializer.save(enterprise=self.request.user)

# backend/api/views.py
from .models import ChatMessage
from .serializers import ChatMessageSerializer

class ConsultationRequestViewSet(viewsets.ModelViewSet):
    queryset = ConsultationRequest.objects.all().order_by('-created_at') # Sắp xếp mới nhất lên đầu
    serializer_class = ConsultationRequestSerializer
    
    # --- SỬA ĐOẠN NÀY ---
    def get_permissions(self):
        # Cho phép bất kỳ ai (kể cả khách) được gửi yêu cầu (POST)
        if self.action == 'create':
            return [permissions.AllowAny()]
        # Các hành động xem/xóa/sửa thì bắt buộc phải đăng nhập
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        # Nếu chưa đăng nhập (trường hợp hiếm khi lọt vào get_queryset trừ khi code lỗi) thì trả rỗng
        if self.action == 'messages':
            return ConsultationRequest.objects.all()

        if not self.request.user.is_authenticated:
            return ConsultationRequest.objects.none()

        user = self.request.user
        # Admin/Staff thấy tất cả, User thường chỉ thấy của mình
        if user.role in ['admin', 'super_admin', 'staff']:
            return ConsultationRequest.objects.all().order_by('-created_at')
        return ConsultationRequest.objects.filter(user=user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def assign_processor(self, request, pk=None):
        consultation = self.get_object()
        if not consultation.processor:
            consultation.processor = request.user
            consultation.status = 'processed'
            consultation.save()
        return Response({"status": "assigned", "processor": request.user.username})

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        consultation = self.get_object()

        # 1. LẤY DANH SÁCH TIN NHẮN
        if request.method == 'GET':
            messages = consultation.messages.all().order_by('created_at')
            serializer = ChatMessageSerializer(messages, many=True)
            return Response(serializer.data)

        # 2. GỬI TIN NHẮN MỚI
        if request.method == 'POST':
            message_text = request.data.get('message', '')
            attachment = request.FILES.get('attachment') # Nếu có gửi file

            if not message_text and not attachment:
                return Response({"error": "Vui lòng nhập nội dung"}, status=status.HTTP_400_BAD_REQUEST)

            # Tạo tin nhắn mới
            new_message = ChatMessage.objects.create(
                consultation=consultation,
                sender=request.user,
                message=message_text,
                attachment=attachment,
                is_staff_reply=False # Đánh dấu đây là tin nhắn của khách
            )
            
            return Response(ChatMessageSerializer(new_message).data, status=status.HTTP_201_CREATED)


class NewsViewSet(viewsets.ModelViewSet):
    queryset = News.objects.all()
    serializer_class = NewsSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'destroy']:
            return [IsTISAdminOrStaff()]
        return [permissions.AllowAny()]

class CartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        items = cart.items.all()
        total_price = sum(item.package.price * item.quantity for item in items)
        return Response({
            "items": CartItemSerializer(items, many=True).data,
            "total_price": total_price,
            "total_items": items.count()
        })

    @action(detail=False, methods=['post'])
    def add(self, request):
        package_id = request.data.get('package_id')
        try:
            quantity = parse_positive_int(request.data.get('quantity', 1))
            cart, _ = Cart.objects.get_or_create(user=request.user)
            package = ProductPackage.objects.get(id=package_id)
            item, created = CartItem.objects.get_or_create(cart=cart, package=package)
            if not created:
                item.quantity += quantity
            item.save()
            return Response({"status": "Added to cart"})
        except ProductPackage.DoesNotExist:
             return Response({"error": "Product Package not found"}, status=404)
        except ValueError as e:
             return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        item_id = request.data.get('item_id')
        try:
            quantity = int(request.data.get('quantity'))
            item = CartItem.objects.get(id=item_id, cart__user=request.user)
            if quantity <= 0:
                item.delete()
            else:
                item.quantity = quantity
                item.save()
            return Response({"status": "Cart updated"})
        except CartItem.DoesNotExist:
            return Response({"error": "Item not found"}, status=404)
        except (TypeError, ValueError):
            return Response({"error": "quantity không hợp lệ"}, status=400)

    @action(detail=False, methods=['post'])
    def remove(self, request):
        item_id = request.data.get('item_id')
        try:
            item = CartItem.objects.get(id=item_id, cart__user=request.user)
            item.delete()
            return Response({"status": "Đã xóa sản phẩm khỏi giỏ hàng"})
        except CartItem.DoesNotExist:
            return Response({"error": "Không tìm thấy sản phẩm trong giỏ"}, status=404)


# --- UTILITY VIEWS ---

class DashboardSummaryView(APIView):
    """Báo cáo Dashboard tổng hợp cho quản trị viên"""
    permission_classes = [IsTISAdminOrStaff]

    def get(self, request):
        total_revenue = Order.objects.filter(status='active').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(status='pending').count()
        recent_orders = Order.objects.order_by('-created_at')[:5]

        return Response({
            "revenue": total_revenue,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "recent_orders": OrderSerializer(recent_orders, many=True).data
        })




# backend/api/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import ConsultationRequest
from .serializers import ConsultationRequestSerializer

@api_view(['PATCH'])
@permission_classes([IsTISAdminOrStaff])
def update_consultation_status(request, pk):
    try:
        # Tìm cuộc hội thoại theo ID truyền từ URL
        consultation = ConsultationRequest.objects.get(pk=pk)
    except ConsultationRequest.DoesNotExist:
        return Response({'error': 'Không tìm thấy cuộc hội thoại'}, status=404)

    # partial=True cho phép chỉ cập nhật trường 'status' mà không cần gửi lại toàn bộ dữ liệu
    serializer = ConsultationRequestSerializer(consultation, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)
