// fontend/admin/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Gọi API lấy đơn hàng
        const response = await fetchAPI('/orders/');
        
        // 2. Xử lý dữ liệu (Fix lỗi Phân trang của Django)
        // Nếu API trả về dạng { count:..., results: [...] } thì lấy .results, ngược lại lấy chính nó
        const orders = Array.isArray(response) ? response : (response.results || []);

        // 3. Tính toán thống kê
        // Tổng doanh thu (Chỉ tính đơn đã xác nhận/thành công nếu cần, ở đây tính hết)
        const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        document.getElementById('stat-revenue').innerText = formatMoney(totalRevenue);

        // Số đơn chờ duyệt
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        document.getElementById('stat-pending').innerText = pendingCount;

        // Tổng số đơn
        document.getElementById('stat-total').innerText = response.count || orders.length;

        // 4. Hiển thị bảng (Top 5 đơn mới nhất)
        const tableBody = document.getElementById('dashboard-orders');
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Chưa có đơn hàng nào</td></tr>';
        } else {
            tableBody.innerHTML = orders.slice(0, 5).map(o => {
                // Dịch trạng thái sang tiếng Việt
                let statusBadge = '';
                let statusText = '';
                
                switch(o.status) {
                    case 'pending': 
                        statusBadge = 'bg-warning text-dark'; statusText = 'Chờ duyệt'; break;
                    case 'confirmed': 
                        statusBadge = 'bg-primary'; statusText = 'Đã xác nhận'; break;
                    case 'completed': 
                        statusBadge = 'bg-success'; statusText = 'Hoàn thành'; break;
                    case 'cancelled': 
                        statusBadge = 'bg-danger'; statusText = 'Đã hủy'; break;
                    default: 
                        statusBadge = 'bg-secondary'; statusText = o.status;
                }

                // Lấy tên khách hàng (xử lý trường hợp user là null hoặc object)
                let customerName = 'Khách lẻ';
                if (o.full_name) customerName = o.full_name;
                else if (o.user && o.user.first_name) customerName = `${o.user.first_name} ${o.user.last_name}`;

                return `
                <tr>
                    <td><span class="fw-bold">#${o.id}</span></td>
                    <td>${customerName}</td>
                    <td class="text-danger fw-bold">${formatMoney(o.total_amount)}</td>
                    <td><span class="badge ${statusBadge}">${statusText}</span></td>
                    <td>${new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                </tr>
                `;
            }).join('');
        }

    } catch (e) { 
        console.error("Lỗi tải Dashboard:", e);
        // Hiển thị lỗi ra bảng nếu cần
        document.getElementById('dashboard-orders').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Lỗi kết nối API</td></tr>';
    }
});