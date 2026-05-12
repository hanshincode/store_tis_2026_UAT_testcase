// js/home.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({ duration: 800, once: true });
    }
    loadFeaturedProducts();
    loadLatestNews();
});

// Hàm bổ sung để tránh lỗi undefined
window.handleQuickBuy = async function(packageId, productId) {
    if (!getAccessToken()) {
        Toast.fire({ icon: 'warning', title: 'Vui lòng đăng nhập để mua hàng' });
        setTimeout(() => redirectTo('login.html'), 1500);
        return;
    }
    try {
        await fetchAPI('/cart/add/', 'POST', { 
            product_id: productId, 
            package_id: packageId, 
            quantity: 1 
        });
        Toast.fire({ icon: 'success', title: 'Đã thêm vào giỏ hàng' });
        if (typeof updateCartBadge === 'function') updateCartBadge();
    } catch (e) {
        Toast.fire({ icon: 'error', title: 'Không thể thêm vào giỏ hàng' });
    }
};

async function loadFeaturedProducts() {
    const container = document.getElementById('product-list');
    if (!container) return;

    try {
        // Gọi API lấy danh sách (thường trang chủ chỉ lấy 6-8 sản phẩm nổi bật hoặc mới nhất)
        const products = await fetchAPI('/products/');
        
        if (!products || products.length === 0) {
            container.innerHTML = '<div class="col-12 text-center py-5 text-muted">Chưa có sản phẩm nào.</div>';
            return;
        }

        // Lấy 6 sản phẩm đầu tiên
        container.innerHTML = products.slice(0, 6).map((p, idx) => {
            // 1. XỬ LÝ ẢNH (Logic cũ của bạn)
            let imageUrl = 'https://placehold.co/400x250?text=TIS+Broker';
            if (p.images?.length > 0) imageUrl = mediaUrl(p.images[0].image);

            // 2. XỬ LÝ MÔ TẢ
            const cleanDesc = p.description ? p.description.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : 'An tâm bảo vệ tài chính cùng TIS.';
            
            // 3. XỬ LÝ GIÁ & NÚT MUA (Logic MỚI - Fix lỗi hiển thị Liên hệ)
            let priceDisplayHTML = '';
            let actionButtonHTML = '';
            const defaultPackageId = p.packages?.[0]?.id || null;

            if (p.is_price_hidden) {
                // TRƯỜNG HỢP: GIÁ LIÊN HỆ
                priceDisplayHTML = `<span class="text-danger fw-bold h5">Liên hệ</span>`;
                // Nút chuyển thành "Xem chi tiết" vì không thể mua nhanh nếu không có giá
                actionButtonHTML = `
                    <button onclick="window.location.href='product-detail.html?id=${p.id}'" 
                            class="btn btn-outline-danger btn-sm rounded-pill px-3">
                        Xem chi tiết
                    </button>`;
            } else {
                // TRƯỜNG HỢP: CÓ GIÁ
                priceDisplayHTML = `
                    <small class="text-muted d-block">Phí từ</small>
                    <span class="text-danger fw-bold h5">${formatMoney(p.base_price)}</span>`;
                
                actionButtonHTML = `
                    <button onclick="event.stopPropagation(); handleQuickBuy(${defaultPackageId}, ${p.id})" 
                            class="btn btn-danger btn-sm rounded-pill px-3">
                        Mua ngay
                    </button>`;
            }

            return `
                <div class="col-lg-4 col-md-6 mb-4" data-aos="fade-up" data-aos-delay="${idx * 100}">
                    <div class="card h-100 shadow-sm border-0" onclick="window.location.href='product-detail.html?id=${p.id}'" style="cursor: pointer;">
                        <div class="position-relative">
                            <span class="badge bg-danger position-absolute top-0 start-0 m-3 shadow-sm">${p.category_name || 'TIS'}</span> <img src="${imageUrl}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${p.name}">
                        </div>
                        <div class="card-body d-flex flex-column">
                            <h5 class="fw-bold text-truncate" title="${p.name}">${p.name}</h5>
                            <p class="text-muted small flex-grow-1">${cleanDesc}</p>
                            <div class="d-flex justify-content-between align-items-end mt-3 pt-3 border-top">
                                <div>
                                    ${priceDisplayHTML}
                                </div>
                                ${actionButtonHTML}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="col-12 text-center py-5 text-danger">Lỗi kết nối máy chủ.</div>';
    }
}

async function loadLatestNews() {
    const container = document.getElementById('news-list');
    if (!container) return;

    try {
        const news = await fetchAPI('/news/');
        
        if (!news || news.length === 0) {
            container.innerHTML = '<div class="col-12 text-center py-4 text-muted">Đang cập nhật bài viết mới...</div>';
            return;
        }

        container.innerHTML = news.slice(0, 3).map((n, idx) => {
            let imageUrl = 'https://placehold.co/400x250/f8f9fa/6c757d?text=TIS+News';
            if (n.image) imageUrl = mediaUrl(n.image);
            
            let cleanDesc = n.content ? n.content.replace(/(<([^>]+)>)/gi, "").substring(0, 90) + '...' : 'Đang cập nhật nội dung...';
            let dateStr = n.created_at ? new Date(n.created_at).toLocaleDateString('vi-VN') : '';

            return `
                <div class="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="${idx * 100}">
                    <div class="card news-card bg-white rounded-4 shadow-sm h-100 overflow-hidden border-0 cursor-pointer" 
                         onclick="window.location.href='news-detail.html?id=${n.id}'">
                        <div class="product-img-wrapper" style="height: 180px;">
                            <img src="${imageUrl}" alt="${n.title}" onerror="this.onerror=null; this.src='https://placehold.co/400x250/f8f9fa/6c757d?text=TIS+News';">
                        </div>
                        <div class="card-body p-4 d-flex flex-column">
                            <div class="d-flex align-items-center mb-2 text-muted small">
                                <i class="far fa-calendar-alt me-2 text-danger"></i> ${dateStr}
                            </div>
                            <h5 class="fw-bold mb-3 product-title">
                                <a href="news-detail.html?id=${n.id}" class="text-dark text-decoration-none hover-red">${n.title}</a>
                            </h5>
                            <p class="text-secondary small mb-0 flex-grow-1">${cleanDesc}</p>
                            <span class="text-danger small fw-bold text-decoration-none mt-3">Đọc tiếp <i class="fas fa-arrow-right ms-1"></i></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Lỗi tải tin tức:", e);
        container.innerHTML = '';
    }
}
