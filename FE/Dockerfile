# fontend/Dockerfile
FROM nginx:alpine

# Xóa các file mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy toàn bộ code frontend vào thư mục phục vụ web của Nginx
COPY . /usr/share/nginx/html/

# Mở port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]