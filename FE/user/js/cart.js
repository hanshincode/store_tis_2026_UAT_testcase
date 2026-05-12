document.addEventListener("DOMContentLoaded", function () {
    loadCartData();
});

// Hàm định dạng tiền tệ (VNĐ)
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Lấy dữ liệu giỏ hàng từ API
async function loadCartData() {
    const container = document.getElementById('cart-container');
    try {
        const response = await fetchAPI('/cart/', 'GET');
        
        if (!response || !response.items || response.items.length === 0) {
            renderEmptyCart(container);
            return;
        }

        renderCartUI(container, response);
    } catch (error) {
        console.error("Lỗi khi tải giỏ hàng:", error);
        container.innerHTML = `<div class="alert alert-danger text-center w-100">Không thể tải giỏ hàng. Vui lòng thử lại.</div>`;
    }
}

// Hiển thị khi giỏ hàng trống
function renderEmptyCart(container) {
    container.innerHTML = `
        <div class="col-12 text-center bg-white p-5 rounded-4 shadow-sm">
            <i class="fas fa-shopping-cart cart-empty-icon mb-3"></i>
            <h5 class="fw-bold text-muted mb-3">Giỏ hàng của bạn đang trống</h5>
            <p class="text-muted mb-4">Hãy thêm các gói bảo hiểm vào giỏ hàng để tiến hành thanh toán nhé.</p>
            <a href="../products.html" class="btn btn-danger px-4 py-2 rounded-pill shadow-sm">
                <i class="fas fa-arrow-left me-2"></i> Tiếp tục mua sắm
            </a>
        </div>
    `;
}

// Render giao diện giỏ hàng
function renderCartUI(container, cart) {
    // 1. Dựng HTML danh sách sản phẩm
    let itemsHtml = cart.items.map(item => {
        let imgUrl = item.image ? mediaUrl(item.image) : 'https://placehold.co/100x100/f8f9fa/d71920?text=TIS';
        let pkgName = item.package_name || 'Gói bảo hiểm';
        let prodName = item.product_name || 'Bảo hiểm TIS';
        let price = item.subtotal || (item.price * item.quantity);

        return `
            <div class="d-flex align-items-center bg-white p-3 rounded-4 shadow-sm border-0 mb-3 cart-item-row" id="cart-item-${item.id}">
                <img src="${imgUrl}" class="cart-item-img me-3 border">
                
                <div class="flex-grow-1">
                    <span class="badge bg-danger-subtle text-danger mb-1 px-2 py-1 rounded-1 small">${prodName}</span>
                    <h6 class="fw-bold mb-1">${pkgName}</h6>
                    <div class="text-danger fw-bold mb-2 d-md-none">${formatMoney(price)}</div>
                    
                    <div class="d-flex align-items-center mt-2">
                        <span class="text-muted small me-2">Số lượng:</span>
                        <div class="input-group input-group-sm" style="width: 100px;">
                            <button class="btn btn-outline-secondary" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                            <input type="text" class="form-control text-center px-1" value="${item.quantity}" readonly>
                            <button class="btn btn-outline-secondary" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        </div>
                    </div>
                </div>

                <div class="text-end ms-3 d-none d-md-block" style="min-width: 120px;">
                    <div class="text-danger fw-bold fs-5 mb-3">${formatMoney(price)}</div>
                    <button class="btn btn-outline-secondary btn-sm" onclick="removeItem(${item.id})">
                        <i class="fas fa-trash-alt me-1"></i> Xóa
                    </button>
                </div>
                
                <button class="btn btn-link text-secondary p-0 ms-2 d-md-none" onclick="removeItem(${item.id})">
                    <i class="fas fa-times fs-5"></i>
                </button>
            </div>
        `;
    }).join('');

    let totalPrice = cart.total_price || 0;

    // 2. Dựng HTML hoàn chỉnh
    container.innerHTML = `
        <div class="col-lg-8 mb-4">
            ${itemsHtml}
            <a href="../products.html" class="btn btn-link text-decoration-none text-danger fw-bold p-0 mt-2">
                <i class="fas fa-arrow-left me-1"></i> Chọn thêm sản phẩm khác
            </a>
        </div>
        
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm rounded-4 position-sticky" style="top: 100px;">
                <div class="card-header bg-white border-bottom p-4 rounded-top-4">
                    <h5 class="fw-bold mb-0">Tóm tắt đơn hàng</h5>
                </div>
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between mb-3 text-muted">
                        <span>Tạm tính (${cart.total_items} sản phẩm)</span>
                        <span class="fw-bold text-dark">${formatMoney(totalPrice)}</span>
                    </div>
                    <hr class="text-muted my-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold fs-5 text-dark">Tổng cộng</span>
                        <span class="fw-bolder fs-4 text-danger">${formatMoney(totalPrice)}</span>
                    </div>
                    <small class="text-muted d-block text-end mb-4">(Đã bao gồm VAT nếu có)</small>
                    
                    <button class="btn btn-danger btn-lg w-100 rounded-pill fw-bold shadow" onclick="processCheckout()">
                        THANH TOÁN NGAY
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Gọi API cập nhật số lượng
async function updateQuantity(itemId, newQuantity) {
    if (newQuantity < 1) {
        removeItem(itemId);
        return;
    }
    
    try {
        // Overlay loading nhẹ
        Swal.showLoading();
        await fetchAPI(`/cart/update_item/`, 'POST', { item_id: itemId, quantity: newQuantity });
        Swal.close();
        loadCartData(); // Tải lại giỏ hàng để lấy giá trị mới
    } catch (error) {
        Swal.fire('Lỗi', 'Không thể cập nhật số lượng', 'error');
    }
}

// Gọi API xóa sản phẩm
async function removeItem(itemId) {
    Swal.fire({
        title: 'Xóa sản phẩm?',
        text: "Bạn có chắc chắn muốn bỏ sản phẩm này khỏi giỏ hàng?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#D71920',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Xóa ngay',
        cancelButtonText: 'Giữ lại'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                Swal.showLoading();
                await fetchAPI(`/cart/remove/`, 'POST', { item_id: itemId });
                Swal.close();
                loadCartData(); // Tải lại giao diện
            } catch (error) {
                Swal.fire('Lỗi', 'Không thể xóa sản phẩm', 'error');
            }
        }
    });
}

// Gọi API thanh toán (Tạo đơn)
async function processCheckout() {
    Swal.fire({
        title: 'Xác nhận đặt hàng',
        text: "Hệ thống sẽ tạo đơn hàng với các sản phẩm trong giỏ.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Đồng ý Đặt mua',
        cancelButtonText: 'Hủy'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Đang xử lý...', allowOutsideClick: false });
            Swal.showLoading();
            
            try {
                const response = await fetchAPI('/orders/checkout_cart/', 'POST', {});
                Swal.fire({
                    icon: 'success',
                    title: 'Đặt hàng thành công!',
                    text: `Mã đơn hàng: ${response.code || 'Đã ghi nhận'}`,
                    confirmButtonColor: '#D71920'
                }).then(() => {
                    // Đặt hàng xong chuyển tới trang quản lý đơn hàng
                    redirectTo('user/orders.html'); 
                });
            } catch (error) {
                Swal.fire('Lỗi', 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.', 'error');
            }
        }
    });
}
