/**
 * js/product-detail.js
 * Phiên bản: Insurance Style (Đã tách CSS)
 */

let currentProduct = null;
let selectedPackageId = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'products.html';
        return;
    }
    loadProductDetail(productId);
});

async function loadProductDetail(id) {
    const container = document.getElementById('product-detail-container');
    const descContainer = document.getElementById('product-long-desc');
    
    try {
        currentProduct = await fetchAPI(`/products/${id}/`);
        
        // 1. Cập nhật Breadcrumb
        const breadcrumb = document.getElementById('breadcrumb-name');
        if (breadcrumb) breadcrumb.innerText = currentProduct.name;

        // 2. Render UI Chính (2 Cột)
        renderInsuranceUI();

        // 3. Render Chi tiết quyền lợi (CKEditor Content)
        if(descContainer) {
            descContainer.innerHTML = currentProduct.description || 
                '<div class="text-center text-muted p-5 fst-italic">Chi tiết quyền lợi đang được cập nhật.</div>';
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-file-excel fa-3x text-muted mb-3"></i>
                <h4 class="fw-bold">Gói bảo hiểm không khả dụng</h4>
                <a href="products.html" class="btn btn-outline-danger rounded-pill mt-3">Xem gói khác</a>
            </div>`;
    }
}

function renderInsuranceUI() {
    const container = document.getElementById('product-detail-container');
    const p = currentProduct;
    if (!p) return;

    // --- A. XỬ LÝ ẢNH ---
    let mainImageUrl = getValidImageUrl(p.images?.length > 0 ? p.images[0].image : null);
    let thumbnailsHtml = '';
    
    // Nếu có nhiều ảnh thì render thumbnails
    if (p.images && p.images.length > 1) {
        thumbnailsHtml = p.images.map((imgObj, idx) => {
            let thumbUrl = getValidImageUrl(imgObj.image);
            return `
                <div class="thumb-item ${idx === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${thumbUrl}')">
                    <img src="${thumbUrl}">
                </div>`;
        }).join('');
    }

    // --- B. XỬ LÝ GIÁ VÀ GÓI (LOGIC QUAN TRỌNG) ---
    let packagesHtml = '';
    let displayPrice = '';
    const isHidden = p.is_price_hidden;

    // Xác định giá hiển thị ban đầu
    if (isHidden) {
        displayPrice = '<span class="text-primary fw-bold fs-3">Liên hệ</span>';
    } else {
        if (p.packages?.length > 0) {
            displayPrice = formatMoney(p.packages[0].price);
            selectedPackageId = p.packages[0].id;
        } else {
            displayPrice = p.base_price ? formatMoney(p.base_price) : 'Đang cập nhật';
        }
    }

    // Render danh sách gói (3 tháng, 6 tháng, 1 năm...)
    if (p.packages && p.packages.length > 0) {
        packagesHtml = p.packages.map((pkg, idx) => {
            const pkgPrice = isHidden ? 'Liên hệ' : formatMoney(pkg.price);
            const isSelected = idx === 0 ? 'selected' : '';
            const durationText = pkg.duration_label || `${pkg.duration_days} ngày`;
            
            // Icon minh họa thời hạn
            let iconClass = 'fa-calendar-alt';
            if(pkg.duration_days <= 90) iconClass = 'fa-calendar-day'; // Ngắn
            else if(pkg.duration_days >= 365) iconClass = 'fa-calendar-check'; // Dài

            return `
                <div class="selection-card ${isSelected}" 
                     onclick="selectPackageCard(this, ${pkg.id}, ${pkg.price})">
                    <div class="d-flex align-items-center gap-3">
                        <div class="icon-box">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="card-content">
                            <h6 class="mb-0 fw-bold text-dark">${durationText}</h6>
                            <small class="text-muted">Bảo vệ toàn diện</small>
                        </div>
                    </div>
                    <div class="card-price fw-bold text-danger">
                        ${pkgPrice}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Thêm nút "Tùy chỉnh" vào cuối danh sách
    packagesHtml += `
        <div class="selection-card" onclick="selectCustomPackage()">
            <div class="d-flex align-items-center gap-3">
                <div class="icon-box">
                    <i class="fas fa-sliders-h"></i>
                </div>
                <div class="card-content">
                    <h6 class="mb-0 fw-bold text-dark">Tùy chỉnh / Khác</h6>
                    <small class="text-muted">Thiết kế theo nhu cầu</small>
                </div>
            </div>
            <div class="text-muted small">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;

    // --- C. NÚT ACTION (THUẬT NGỮ BẢO HIỂM) ---
    let actionButtons = '';
    if (isHidden) {
        actionButtons = `
            <button class="btn btn-danger w-100 rounded-pill p-3 fw-bold mb-2 shadow-sm" onclick="requestConsultation()">
                <i class="fas fa-phone-alt me-2"></i> Liên hệ tư vấn phí
            </button>`;
    } else {
        actionButtons = `
            <button class="btn btn-danger w-100 rounded-pill p-3 fw-bold mb-3 shadow-sm" onclick="addToCart()">
                <i class="fas fa-shield-alt me-2"></i> Chọn mua gói này
            </button>
            <button class="btn btn-outline-dark w-100 rounded-pill p-3 fw-bold bg-white" onclick="requestConsultation()">
                <i class="fas fa-headset me-2"></i> Cần tư vấn thêm?
            </button>`;
    }

    // --- D. RENDER HTML ---
    container.innerHTML = `
        <div class="row gx-lg-5">
            <div class="col-lg-7 mb-4 mb-lg-0">
                <div class="product-gallery-wrapper">
                    <span class="badge bg-danger mb-3 rounded-pill px-3 py-2 shadow-sm text-uppercase">
                        ${p.category_name || 'Gói bảo hiểm'}
                    </span>
                    <h1 class="product-title d-lg-none mb-3 lh-sm">${p.name}</h1>
                    
                    <div class="main-img-container position-relative">
                        ${p.provider_name ? `<span class="badge bg-dark position-absolute top-0 end-0 m-3 opacity-75">${p.provider_name}</span>` : ''}
                        <img src="${mainImageUrl}" id="main-product-image" alt="${p.name}">
                    </div>
                    
                    <div class="thumbnail-list">
                        ${thumbnailsHtml}
                    </div>
                    
                    <div class="mt-4 d-flex justify-content-center gap-4 text-muted small">
                        <span><i class="fas fa-check-circle text-success me-1"></i> Chính hãng</span>
                        <span><i class="fas fa-bolt text-warning me-1"></i> Cấp đơn nhanh</span>
                    </div>
                </div>
            </div>

            <div class="col-lg-5">
                <div class="product-info-wrapper">
                    <h2 class="product-title d-none d-lg-block mb-2 lh-sm">${p.name}</h2>
                    <div class="d-flex align-items-center gap-2 mb-4">
                        <span class="badge bg-light text-dark border">
                            <i class="fas fa-user-shield me-1"></i> ${p.target_audience === 'ent' ? 'Doanh nghiệp' : 'Cá nhân'}
                        </span>
                        <span class="text-muted small">Cung cấp bởi: <strong>${p.provider_name || 'TIS Broker'}</strong></span>
                    </div>

                    <div class="mb-1 text-muted small text-uppercase fw-bold">Phí bảo hiểm:</div>
                    <div class="product-price mb-4" id="display-price">${displayPrice}</div>
                    
                    <p class="text-secondary mb-5 small" style="line-height: 1.6;">
                        ${p.short_description || 'Thông tin tóm tắt quyền lợi đang cập nhật.'}
                    </p>

                    <div class="mb-3 fw-bold text-dark d-flex justify-content-between align-items-center">
                        <span>Chọn thời hạn:</span>
                        <small class="text-muted fw-normal"><i class="far fa-clock"></i> Hiệu lực ngay</small>
                    </div>
                    <div class="mb-5 selection-group">
                        ${packagesHtml}
                    </div>

                    <div class="policy-info-box desktop-actions">
                        <div class="d-flex justify-content-between mb-2 text-muted small">
                            <span>Hình thức cấp đơn:</span>
                            <span class="text-dark fw-bold"><i class="fas fa-qrcode text-danger"></i> GCN Điện tử</span>
                        </div>
                        <div class="d-flex justify-content-between mb-4 text-muted small">
                            <span>Phạm vi:</span>
                            <span class="text-dark fw-bold">Toàn lãnh thổ Việt Nam</span>
                        </div>
                        <hr class="opacity-25 my-3">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- LOGIC UI TƯƠNG TÁC ---

// 1. Chọn Gói (3 tháng, 6 tháng...)
window.selectPackageCard = function(element, id, price) {
    selectedPackageId = id;
    
    // UI Update (Active state)
    document.querySelectorAll('.selection-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    
    // Price Update (Nếu không ẩn giá)
    if (currentProduct && !currentProduct.is_price_hidden) {
        const displayEl = document.getElementById('display-price');
        if (displayEl) {
            displayEl.style.opacity = 0.5;
            setTimeout(() => {
                displayEl.innerText = formatMoney(price);
                displayEl.style.opacity = 1;
            }, 150);
        }
    }
};

// 2. Chọn Gói Custom (Tùy chỉnh) -> Mở Modal
window.selectCustomPackage = function() {
    // Xóa active các gói khác
    document.querySelectorAll('.selection-card').forEach(el => el.classList.remove('selected'));
    selectedPackageId = null; // Reset gói đã chọn

    requestConsultation(`Tôi muốn tùy chỉnh thời hạn cho gói: ${currentProduct.name}`);
}

// 3. Đổi ảnh chính
window.changeMainImage = function(el, url) {
    const mainImg = document.getElementById('main-product-image');
    if (mainImg) {
        mainImg.style.opacity = 0;
        setTimeout(() => {
            mainImg.src = url;
            mainImg.style.opacity = 1;
        }, 200);
    }
    document.querySelectorAll('.thumb-item').forEach(img => img.classList.remove('active'));
    el.classList.add('active');
};

// --- LOGIC GỌI API ---

// 4. Mở Modal Tư vấn
// --- 4. LOGIC MỞ MODAL TƯ VẤN (CÓ TỰ ĐỘNG ĐIỀN) ---
window.requestConsultation = async function(prefillNote = '') {
    const modalEl = document.getElementById('consultationModal');
    if (!modalEl) return;

    // 1. Chuẩn bị các ô input
    const nameInput = document.getElementById('consult-name');
    const contactInput = document.getElementById('consult-contact');
    const noteInput = document.getElementById('consult-note');

    // 2. Điền nội dung Ghi chú (nếu có)
    // Ví dụ: "Tôi muốn tùy chỉnh thời hạn..." hoặc "Tư vấn sản phẩm X"
    const defaultNote = prefillNote || (currentProduct ? `Tư vấn sản phẩm: ${currentProduct.name}` : '');
    if (noteInput) noteInput.value = defaultNote;

    // 3. TỰ ĐỘNG HÓA: Lấy thông tin User nếu đã đăng nhập
    const token = getAccessToken();
    if (token) {
        try {
            // Có thể thêm loading nhỏ ở nút bấm nếu mạng chậm
            const user = await fetchAPI('/users/me/');
            
            // Tự động điền Họ tên
            if (nameInput) {
                const fullName = (user.last_name || '') + ' ' + (user.first_name || '');
                nameInput.value = fullName.trim() || user.username;
                nameInput.readOnly = true; // (Tùy chọn) Chặn sửa nếu muốn cứng
                nameInput.classList.add('bg-light'); // Làm mờ để báo hiệu đã điền tự động
            }

            // Tự động điền SĐT hoặc Email
            if (contactInput) {
                contactInput.value = user.phone || user.email || '';
                if(user.phone) {
                    contactInput.readOnly = true; // Ưu tiên SĐT, nếu có thì khóa lại
                    contactInput.classList.add('bg-light');
                }
            }
        } catch (err) {
            console.warn("Không lấy được thông tin user tự động:", err);
            // Nếu lỗi token thì cứ để form trống cho khách nhập tay
        }
    } else {
        // Nếu chưa đăng nhập: Reset form về trống để khách nhập
        if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; nameInput.classList.remove('bg-light'); }
        if (contactInput) { contactInput.value = ''; contactInput.readOnly = false; contactInput.classList.remove('bg-light'); }
    }

    // 4. Hiển thị Modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    // 5. Xử lý sự kiện Submit Form
    const form = document.getElementById('consultation-form');
    // Xóa sự kiện cũ để tránh gửi lặp (quan trọng khi mở modal nhiều lần)
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.onsubmit = async (e) => {
        e.preventDefault();
        
        // UI Loading button
        const btn = newForm.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

        try {
            const payload = {
                product: currentProduct ? currentProduct.id : null,
                customer_name: document.getElementById('consult-name').value,
                customer_contact: document.getElementById('consult-contact').value,
                note: document.getElementById('consult-note').value
            };
            
            // Gửi kèm User ID nếu có
            if(token) {
                 try { const user = await fetchAPI('/users/me/'); payload.user = user.id; } catch(err) {}
            }

            await fetchAPI('/consultations/', 'POST', payload);
            
            modal.hide();
            
            // Thông báo thành công kiểu Bảo hiểm
            Swal.fire({
                title: 'Đã tiếp nhận yêu cầu!',
                html: `<p>Hệ thống đã ghi nhận thông tin.</p>
                       <p class="small text-muted">Chuyên viên tư vấn sẽ liên hệ qua số <b>${payload.customer_contact}</b> trong giây lát.</p>`,
                icon: 'success',
                confirmButtonColor: '#D71920',
                confirmButtonText: 'Hoàn tất'
            });
            
        } catch (err) {
            Toast.fire({ icon: 'error', title: 'Lỗi kết nối. Vui lòng gọi Hotline.' });
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };
};

// 5. Thêm vào giỏ (Mua ngay)
window.addToCart = async function() {
    // Nếu giá ẩn -> Bắt buộc tư vấn
    if (currentProduct && currentProduct.is_price_hidden) {
        requestConsultation();
        return;
    }
    
    // Kiểm tra đăng nhập
    if (!getAccessToken()) {
        Swal.fire({
            title: 'Đăng nhập',
            text: "Quý khách cần đăng nhập để quản lý hợp đồng.",
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#D71920',
            confirmButtonText: 'Đăng nhập ngay',
            cancelButtonText: 'Để sau'
        }).then((r) => { if (r.isConfirmed) redirectTo('login.html'); });
        return;
    }

    // Kiểm tra đã chọn gói chưa
    if (!selectedPackageId) {
        Toast.fire({ icon: 'warning', title: 'Vui lòng chọn thời hạn bảo hiểm.' });
        return;
    }

    try {
        await fetchAPI('/cart/add/', 'POST', { package_id: selectedPackageId, quantity: 1 });
        
        Swal.fire({
            title: 'Đã thêm vào giỏ!',
            text: "Quý khách muốn thanh toán ngay?",
            icon: 'success',
            showCancelButton: true,
            confirmButtonColor: '#D71920',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Thanh toán',
            cancelButtonText: 'Xem tiếp'
        }).then((r) => { if (r.isConfirmed) redirectTo('user/cart.html'); });

    } catch (e) { 
        Toast.fire({ icon: 'error', title: 'Lỗi thêm vào giỏ hàng' }); 
    }
};



// Gọi hàm này khi khách bấm nút "Thêm vào giỏ hàng"
async function addToCart(packageId, quantity = 1) {
    if (!getAccessToken()) {
        Swal.fire({
            icon: 'warning',
            title: 'Yêu cầu đăng nhập',
            text: 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.',
            confirmButtonText: 'Đăng nhập ngay',
            showCancelButton: true,
            cancelButtonText: 'Đóng'
        }).then((result) => {
            if (result.isConfirmed) {
                redirectTo('login.html');
            }
        });
        return;
    }

    try {
        await fetchAPI('/cart/add/', 'POST', { 
            package_id: packageId, 
            quantity: quantity 
        });
        
        // Hiện thông báo dạng Toast (Góc phải màn hình)
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Đã thêm vào giỏ hàng',
            showConfirmButton: false,
            timer: 2000
        });
    } catch (error) {
        Swal.fire('Lỗi', 'Không thể thêm vào giỏ hàng. Vui lòng thử lại.', 'error');
    }
}





function getValidImageUrl(path) {
    return mediaUrl(path);
}
