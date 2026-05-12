# Sử dụng Python 3.11 bản slim để tối ưu dung lượng
FROM python:3.11-slim

# Thiết lập biến môi trường
ENV PYTHONDONTWRITEBYTECODE=1 
ENV PYTHONUNBUFFERED=1

# Tạo thư mục làm việc trong container
WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho PostgreSQL và các công cụ build
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements.txt vào container
# Lưu ý: context được đặt ở thư mục cha (backend)
COPY requirements.txt /app/

# Nâng cấp pip và cài đặt các thư viện Python
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào container
COPY . /app/

# Tạo thư mục cho file media và static
RUN mkdir -p /app/media /app/static

# Mở port 8000 cho Daphne
EXPOSE 8000

# Chạy server bằng Daphne (ASGI) để hỗ trợ WebSocket
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "insurance_project.asgi:application"]