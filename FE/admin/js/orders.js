/**
 * admin/js/orders.js
 * Quản lý đơn đặt mua bảo hiểm của khách hàng
 */

document.addEventListener('DOMContentLoaded', () => loadOrders('all'));

window.loadOrders = async function(statusFilter) {
    const tbody = document.getElementById('orders-list');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Đang tải đơn hàng...</td></tr>';

    try {
        let orders = await fetchAPI('/orders/');
        if (statusFilter !== 'all') {
            orders = orders.filter(o => o.status === statusFilter);
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="ps-4 fw-bold text-primary">${o.code}</td>
                <td>
                    <div class="fw-bold">${o.user_name || 'Khách vãng lai'}</div>
                    <small class="text-muted">${new Date(o.created_at).toLocaleDateString('vi-VN')}</small>
                </td>
                <td>${o.items?.length || 0} sản phẩm</td>
                <td class="fw-bold text-danger">${formatMoney(o.total_amount)}</td>
                <td>${renderOrderStatus(o.status)}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border" onclick="updateOrderStatus(${o.id}, 'active')">
                        <i class="fas fa-check-circle text-success"></i> Duyệt
                    </button>
                    <button class="btn btn-sm btn-light border ms-1" onclick="deleteOrder(${o.id})">
                        <i class="fas fa-times-circle text-danger"></i> Hủy
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Lỗi tải đơn hàng</td></tr>'; }
};

function renderOrderStatus(status) {
    const styles = {
        'pending': 'bg-warning-subtle text-warning border-warning',
        'active': 'bg-success-subtle text-success border-success',
        'cancelled': 'bg-danger-subtle text-danger border-danger'
    };
    const labels = { 'pending': 'Chờ duyệt', 'active': 'Hiệu lực', 'cancelled': 'Đã hủy' };
    return `<span class="badge border ${styles[status] || ''}">${labels[status] || status}</span>`;
}

window.updateOrderStatus = async function(id, status) {
    try {
        await fetchAPI(`/orders/${id}/`, 'PATCH', { status: status });
        Toast.fire({ icon: 'success', title: 'Đã cập nhật đơn hàng' });
        loadOrders('all');
    } catch (e) { Toast.fire({ icon: 'error', title: 'Không thể cập nhật' }); }
};