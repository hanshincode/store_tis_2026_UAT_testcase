// user/js/core.js
document.addEventListener('DOMContentLoaded', async () => {
    if (!getAccessToken()) { redirectTo('login.html'); return; }
    
    try {
        const user = await fetchAPI('/users/me/');
        renderUserLayout(user.first_name || user.username);
        // Bind event đăng xuất
        document.getElementById('btn-user-logout')?.addEventListener('click', window.logout);
    } catch (e) { window.logout(); }
});

function renderUserLayout(userName) {
    const navbar = `
    <nav class="user-navbar sticky-top mb-4">
        <div class="container d-flex justify-content-between align-items-center">
            <a href="index.html" class="text-decoration-none d-flex align-items-center">
                <h4 class="fw-bold text-danger m-0"><i class="fas fa-shield-alt me-2"></i>TIS BROKER</h4>
            </a>
            <div class="d-flex align-items-center">
                <a href="cart.html" class="btn btn-light position-relative me-3">
                    <i class="fas fa-shopping-cart"></i>
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" id="cart-count">0</span>
                </a>
                <div class="dropdown">
                    <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user-circle me-1"></i> Xin chào, ${userName}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="orders.html"><i class="fas fa-file-invoice-dollar me-2"></i>Đơn hàng của tôi</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger cursor-pointer" id="btn-user-logout"><i class="fas fa-sign-out-alt me-2"></i>Đăng xuất</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>`;
    document.body.insertAdjacentHTML('afterbegin', navbar);
    updateCartCount();
}

async function updateCartCount() {
    try {
        const cart = await fetchAPI('/cart/');
        document.getElementById('cart-count').innerText = cart.total_items || 0;
    } catch(e) {}
}
