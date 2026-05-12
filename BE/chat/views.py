from django.utils.text import get_valid_filename
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.core.files.storage import default_storage

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload_chat_attachment(request):
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'Không tìm thấy file'}, status=status.HTTP_400_BAD_REQUEST)

    max_size = 5 * 1024 * 1024
    allowed_types = {
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    if file.size > max_size:
        return Response({'error': 'File quá lớn. Vui lòng chọn file dưới 5MB.'}, status=status.HTTP_400_BAD_REQUEST)

    if file.content_type not in allowed_types:
        return Response({'error': 'Định dạng file không được hỗ trợ.'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Lưu file vào thư mục media/chat_attachments/
    safe_name = get_valid_filename(file.name)
    file_name = default_storage.save(f"chat_attachments/{safe_name}", file)
    
    # 2. Lấy URL tuyệt đối của file
    file_url = request.build_absolute_uri(default_storage.url(file_name))

    # 3. Phân loại là hình ảnh hay tệp thông thường
    attachment_type = 'image' if file.content_type.startswith('image/') else 'document'

    return Response({
        'attachment_url': file_url,
        'attachment_type': attachment_type
    })
