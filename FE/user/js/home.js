// user/js/home.js
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadProducts();
});

async function loadCategories() {
    try {
        const cats = await fetchAPI('/categories/');
        document.getElementById('category-filter').innerHTML += cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {}
}

async function loadProducts() {
    const grid = document.getElementById('product-grid');
    try {
        const products = await fetchAPI('/products/');
        grid.innerHTML = products.map(p => `
            <div class="col-md-4 col-lg-3">
                <div class="card product-card h-100">
                    <div class="product-img-wrapper">
                        <img src="${p.images?.[0]?.image ? mediaUrl(p.images[0].image) : 'https://via.placeholder.com/300'}" alt="${p.name}">
                    </div>
                    <div class="card-body d-flex flex-column">
                        <span class="badge bg-light text-dark mb-2 align-self-start border">${p.provider_name || 'TIS'}</span>
                        <h6 class="fw-bold text-dark mb-3">${p.name}</h6>
                        <div class="mt-auto">
                            ${p.is_price_hidden ? `<div class="price-tag mb-3 text-danger">Giá: Liên hệ</div>` 
                                                : `<div class="price-tag mb-3">${p.packages?.[0] ? formatMoney(p.packages[0].price) : 'Chưa có giá'}</div>`}
                            <button class="btn btn-outline-primary w-100 fw-bold" onclick="window.addToCart(${p.packages?.[0]?.id})">
                                <i class="fas fa-cart-plus me-1"></i> Thêm vào giỏ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch(e) { grid.innerHTML = '<p class="text-danger w-100 text-center">Lỗi tải dữ liệu</p>'; }
}

window.addToCart = async function(packageId) {
    if(!packageId) return Toast.fire({icon: 'warning', title: 'Sản phẩm này cần liên hệ trực tiếp!'});
    try {
        await fetchAPI('/cart/add/', 'POST', { package_id: packageId, quantity: 1 });
        Toast.fire({icon: 'success', title: 'Đã thêm vào giỏ hàng!'});
        updateCartCount(); // Hàm này nằm trong core.js
    } catch(e) { Toast.fire({icon: 'error', title: 'Lỗi thêm vào giỏ'}); }
};
