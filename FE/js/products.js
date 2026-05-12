/**
 * js/products.js
 * Chức năng: Tải và hiển thị danh sách sản phẩm, lọc theo danh mục.
 */

// Biến toàn cục để lưu trữ danh sách sản phẩm (phục vụ cho việc lọc client-side)
let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadProducts();
});

// --- 1. TẢI DANH MỤC (CATEGORY FILTER) ---
// --- 1. TẢI DANH MỤC (CATEGORY FILTER) ---
async function loadCategories() {
    const containerDesktop = document.getElementById('category-list-container');
    const containerMobile = document.getElementById('category-list-mobile');

    try {
        const categories = await fetchAPI('/categories/');
        
        // Tạo mục "Tất cả" mặc định (dùng thẻ <li> theo đúng CSS của sidebar)
        let html = `
            <li class="active" onclick="filterProducts(this, 'all')">
                <i class="fas fa-layer-group me-2"></i> Tất cả sản phẩm
            </li>
        `;
        
        // Tạo các mục danh mục từ API
        if (categories && categories.length > 0) {
            html += categories.map(c => 
                `<li onclick="filterProducts(this, ${c.id})">
                    <i class="fas fa-angle-right me-2 text-danger"></i> ${c.name}
                </li>`
            ).join('');
        }
        
        // Gắn HTML vào cả Desktop và Mobile
        if (containerDesktop) containerDesktop.innerHTML = html;
        if (containerMobile) containerMobile.innerHTML = html;
        
    } catch (e) {
        console.error("Lỗi tải danh mục:", e);
        const errorHtml = `<li class="active">Tất cả sản phẩm (Lỗi kết nối)</li>`;
        if (containerDesktop) containerDesktop.innerHTML = errorHtml;
        if (containerMobile) containerMobile.innerHTML = errorHtml;
    }
}

// --- 4. CHỨC NĂNG LỌC (FILTER) ---
window.filterProducts = function(element, categoryId) {
    // 1. Cập nhật trạng thái Active cho thẻ <li> được chọn
    // Xóa class 'active' khỏi tất cả các <li> trong danh sách danh mục
    document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
    
    // Thêm class 'active' vào mục vừa click
    if (element) {
        element.classList.add('active');
    }

    // 2. Thực hiện lọc trên mảng allProducts
    if (categoryId === 'all') {
        renderProducts(allProducts);
    } else {
        // Lọc các sản phẩm có category id trùng khớp
        const filtered = allProducts.filter(p => p.category == categoryId);
        renderProducts(filtered);
    }

    // 3. Tự động đóng menu trượt (Offcanvas) trên Mobile sau khi khách chọn xong
    const offcanvasEl = document.getElementById('offcanvasCategory');
    if (offcanvasEl) {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvasInstance) {
            offcanvasInstance.hide();
        }
    }
};

// --- 2. TẢI DANH SÁCH SẢN PHẨM ---
async function loadProducts() {
    const container = document.getElementById('product-list');
    if (!container) return;
    
    // Hiển thị loading spinner
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-danger" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>`;

    try {
        // Gọi API lấy toàn bộ sản phẩm
        allProducts = await fetchAPI('/products/');
        window.allProducts = allProducts;
        
        // Render ra màn hình
        renderProducts(allProducts);
    } catch (e) {
        console.error("Lỗi tải sản phẩm:", e);
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <p>Không thể tải dữ liệu sản phẩm.</p>
                <button class="btn btn-sm btn-outline-secondary" onclick="loadProducts()">Thử lại</button>
            </div>`;
    }
}

// --- 3. HIỂN THỊ SẢN PHẨM (RENDER) ---
function renderProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;

    // Nếu không có sản phẩm nào
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5"><h5>Chưa có sản phẩm nào trong mục này.</h5></div>';
        return;
    }

    // Duyệt qua từng sản phẩm và tạo HTML
    const html = products.map(p => {
        // A. XỬ LÝ ẢNH
        // Cấu trúc mới: p.images là một mảng object [{id: 1, image: 'url'}, ...]
        let imgUrl = 'https://placehold.co/400x300/f8f9fa/d71920?text=TIS+Broker';
        if (p.images && p.images.length > 0) imgUrl = mediaUrl(p.images[0].image);

        // B. XỬ LÝ GIÁ TIỀN
        // Kiểm tra cờ is_price_hidden
        let priceDisplay = '';
        if (p.is_price_hidden) {
            priceDisplay = '<span class="text-primary fw-bold">Liên hệ</span>';
        } else if (p.base_price) {
            // formatMoney là hàm tiện ích (thường nằm trong common.js)
            priceDisplay = `<span class="text-danger fw-bold">${formatMoney(p.base_price)}</span>`;
        } else {
            priceDisplay = '<span class="text-muted small">Đang cập nhật</span>';
        }

        // C. XỬ LÝ MÔ TẢ NGẮN
        // Cắt bớt nếu mô tả quá dài (> 80 ký tự)
        let shortDesc = p.short_description || '';
        if (shortDesc.length > 80) {
            shortDesc = shortDesc.substring(0, 80) + '...';
        }

        // D. TẠO HTML CARD
        return `
            <div class="col-md-6 col-lg-4 mb-4 product-item-col">
                <div class="card h-100 border-0 shadow-sm product-card hover-shadow transition-all">
                    <div class="position-relative overflow-hidden" style="border-radius: 8px 8px 0 0;">
                        <a href="product-detail.html?id=${p.id}">
                            <img src="${imgUrl}" class="card-img-top" alt="${p.name}" 
                                 style="height: 250px; object-fit: cover; width: 100%;">
                        </a>
                        ${p.category_name ? `<span class="badge bg-danger position-absolute top-0 start-0 m-3 shadow-sm">${p.category_name}</span>` : ''}
                    </div>
                    
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title fw-bold mb-2 product-title">
                            <a href="product-detail.html?id=${p.id}" class="text-decoration-none text-dark stretched-link-custom">
                                ${p.name}
                            </a>
                        </h5>
                        <p class="card-text text-muted small mb-4 flex-grow-1">
                            ${shortDesc}
                        </p>
                        
                        <div class="d-flex justify-content-between align-items-center mt-auto border-top pt-3">
                            <div class="price-tag">
                                ${priceDisplay}
                            </div>
                            <a href="product-detail.html?id=${p.id}" class="btn btn-outline-danger btn-sm rounded-pill px-3">
                                Xem chi tiết <i class="fas fa-arrow-right ms-1"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// --- CHỨC NĂNG TÌM KIẾM SẢN PHẨM ---
window.searchProducts = function(keyword) {
    // 1. Nếu chưa có dữ liệu sản phẩm thì thoát
    if (!window.allProducts || window.allProducts.length === 0) return;

    // 2. Chuẩn hóa từ khóa (viết thường, bỏ khoảng trắng thừa)
    const term = keyword.toLowerCase().trim();

    // 3. Nếu ô tìm kiếm bị xóa trắng, hiển thị lại toàn bộ sản phẩm
    if (term === '') {
        renderProducts(window.allProducts);
        return;
    }

    // 4. Lọc các sản phẩm có tên chứa từ khóa
    const filteredProducts = window.allProducts.filter(product => 
        product.name.toLowerCase().includes(term)
    );

    // 5. Render lại danh sách
    const container = document.getElementById('product-list');
    
    if (filteredProducts.length > 0) {
        // Nếu có kết quả, gọi hàm render mặc định của bạn
        renderProducts(filteredProducts);
    } else {
        // Nếu không có kết quả, hiển thị thông báo
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted w-100">
                    <i class="fas fa-search mb-3 fa-3x text-light" style="color: #dee2e6;"></i>
                    <p class="fs-5">Không tìm thấy sản phẩm nào phù hợp với "<strong>${keyword}</strong>".</p>
                </div>
            `;
        }
    }
};
