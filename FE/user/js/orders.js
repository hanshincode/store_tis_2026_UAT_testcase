document.addEventListener('DOMContentLoaded', loadMyOrders);

function orderStatusBadge(status) {
    const labels = {
        pending: 'Chờ xác nhận',
        confirmed: 'Đã xác nhận',
        active: 'Đang hiệu lực',
        cancelled: 'Đã hủy'
    };
    const classes = {
        pending: 'bg-warning-subtle text-warning border-warning',
        confirmed: 'bg-info-subtle text-info border-info',
        active: 'bg-success-subtle text-success border-success',
        cancelled: 'bg-danger-subtle text-danger border-danger'
    };
    return `<span class="badge border ${classes[status] || 'bg-light text-muted'}">${labels[status] || status}</span>`;
}

async function loadMyOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    try {
        const orders = normalizeList(await fetchAPI('/orders/'));

        if (!orders.length) {
            container.innerHTML = `
                <div class="text-center bg-white rounded-3 shadow-sm border p-5">
                    <i class="fas fa-file-invoice text-muted mb-3" style="font-size: 4rem; opacity: .35;"></i>
                    <h5 class="fw-bold">Bạn chưa có đơn hàng nào</h5>
                    <p class="text-muted">Các đơn bảo hiểm đã đặt mua sẽ xuất hiện tại đây.</p>
                    <a href="../products.html" class="btn btn-danger rounded-pill px-4">Xem sản phẩm</a>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(order => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemHtml = items.length
                ? items.map(item => `
                    <div class="d-flex justify-content-between gap-3 py-2 border-top">
                        <div>
                            <div class="fw-semibold">${escapeHTML(item.product_name || 'Gói bảo hiểm')}</div>
                            <small class="text-muted">${escapeHTML(item.duration || '')} x ${item.quantity || 1}</small>
                        </div>
                        <div class="text-end fw-semibold">${formatMoney(item.price || 0)}</div>
                    </div>`).join('')
                : '<div class="text-muted small py-2 border-top">Chưa có chi tiết sản phẩm.</div>';

            return `
                <article class="bg-white rounded-3 shadow-sm border mb-3 overflow-hidden">
                    <div class="p-4">
                        <div class="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                            <div>
                                <div class="text-muted small">Mã đơn hàng</div>
                                <h5 class="fw-bold mb-0">${escapeHTML(order.code || `#${order.id}`)}</h5>
                            </div>
                            <div class="text-md-end">
                                ${orderStatusBadge(order.status)}
                                <div class="text-muted small mt-2">${order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : ''}</div>
                            </div>
                        </div>
                        ${itemHtml}
                        <div class="d-flex justify-content-between align-items-center border-top pt-3 mt-2">
                            <span class="fw-bold">Tổng cộng</span>
                            <span class="fs-5 fw-bold text-danger">${formatMoney(order.total_amount || 0)}</span>
                        </div>
                    </div>
                </article>`;
        }).join('');
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHTML(getErrorMessage(error, 'Không thể tải đơn hàng. Vui lòng thử lại.'))}
            </div>`;
    }
}
