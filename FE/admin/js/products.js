/**
 * admin/js/products.js - Quản lý Sản phẩm (CRUD Full)
 */

let allProducts = [];
let myEditor; // Biến lưu instance của CKEditor
let currentProductId = null; // null = Thêm mới, ID = Chỉnh sửa

document.addEventListener('DOMContentLoaded', () => {
    initCKEditor();
    loadCategoriesForSelect(); // Tải danh mục vào thẻ <select> trong Modal
    loadProducts();
});

// --- 1. KHỞI TẠO CKEDITOR ---
function initCKEditor() {
    if (document.querySelector('#p-desc')) {
        ClassicEditor
            .create(document.querySelector('#p-desc'))
            .then(editor => {
                myEditor = editor;
            })
            .catch(error => {
                console.error('Lỗi khởi tạo CKEditor:', error);
            });
    }
}

// --- 2. TẢI DANH MỤC VÀO SELECT ---
async function loadCategoriesForSelect() {
    try {
        const categories = await fetchAPI('/categories/');
        const select = document.getElementById('p-category');
        if (select) {
            select.innerHTML = '<option value="">-- Chọn danh mục --</option>' + 
                categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (e) {
        console.error("Lỗi tải danh mục:", e);
    }
}

// --- 3. TẢI VÀ RENDER DANH SÁCH SẢN PHẨM ---
async function loadProducts() {
    const tbody = document.getElementById('products-list');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Đang tải dữ liệu...</td></tr>';

    try {
        const data = await fetchAPI('/products/');
        // Xử lý phân trang: nếu có .results thì lấy, không thì lấy chính nó
        allProducts = Array.isArray(data) ? data : (data.results || []);
        renderProductTable(allProducts);
    } catch (e) {
        console.error("Lỗi sản phẩm:", e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Lỗi tải dữ liệu!</td></tr>';
    }
}

function renderProductTable(products) {
    const tbody = document.getElementById('products-list');
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Chưa có sản phẩm nào.</td></tr>';
        return;
    }

    const html = products.map(p => {
        // Xử lý ảnh
        let imgUrl = 'https://placehold.co/50x50?text=No+Img';
        if (p.images && p.images.length > 0) imgUrl = mediaUrl(p.images[0].image);

        // Xử lý hiển thị giá
        const priceDisplay = p.is_price_hidden 
            ? '<span class="badge bg-warning text-dark">Giá liên hệ</span>' 
            : `<span class="fw-bold text-success">${formatMoney(p.base_price)}</span>`;
        
        // Label đối tượng
        const targetBadge = p.target_audience === 'ent' 
            ? '<span class="badge bg-info text-dark">Doanh nghiệp</span>'
            : '<span class="badge bg-light text-secondary border">Cá nhân</span>';

        return `
            <tr>
                <td class="ps-4">
                    <img src="${imgUrl}" class="rounded border" width="50" height="50" style="object-fit: cover;">
                </td>
                <td>
                    <div class="fw-bold text-truncate" style="max-width: 200px;" title="${p.name}">${p.name}</div>
                    <small class="text-muted text-truncate d-block" style="max-width: 200px;">${p.short_description || ''}</small>
                </td>
                <td>${p.category_name || '-'}</td>
                <td>${targetBadge}</td>
                <td>${priceDisplay}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal(${p.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// --- 4. CÁC HÀM THAO TÁC MODAL ---

// Mở modal để THÊM MỚI
window.openProductModal = function() {
    currentProductId = null; // Đánh dấu là thêm mới
    resetForm();
    document.querySelector('#productModal .modal-title').innerText = "Thêm Sản Phẩm Mới";
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Mở modal để CHỈNH SỬA
window.openEditModal = function(id) {
    const product = allProducts.find(p => p.id == id);
    if (!product) return;

    currentProductId = id; // Đánh dấu là đang sửa
    
    // Fill dữ liệu vào form
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-short-desc').value = product.short_description || '';
    document.getElementById('p-provider').value = product.provider_name || '';
    document.getElementById('p-category').value = product.category || '';
    document.getElementById('p-target').value = product.target_audience;
    document.getElementById('p-price').value = product.base_price || 0;
    document.getElementById('p-hidden-price').checked = product.is_price_hidden;

    // Fill dữ liệu vào CKEditor
    if (myEditor) {
        myEditor.setData(product.description || '');
    }

    // Hiển thị ảnh cũ (Preview)
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = '';
    if (product.images && product.images.length > 0) {
        product.images.forEach(img => {
            const src = mediaUrl(img.image);
            const div = document.createElement('div');
            div.className = 'position-relative d-inline-block me-2 mb-2';
            div.innerHTML = `
                <img src="${src}" class="rounded border" width="80" height="80" style="object-fit: cover;">
                <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 p-0" 
                    style="width: 20px; height: 20px; line-height: 1;"
                    onclick="deleteImage(${product.id}, ${img.id}, this)">
                    &times;
                </button>
            `;
            previewContainer.appendChild(div);
        });
    }

    document.querySelector('#productModal .modal-title').innerText = `Chỉnh sửa: ${product.name}`;
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Hàm Reset Form về trắng
function resetForm() {
    document.getElementById('product-form').reset();
    document.getElementById('preview-container').innerHTML = '';
    if (myEditor) myEditor.setData('');
}

// --- 5. XỬ LÝ SUBMIT (THÊM HOẶC SỬA) ---
window.submitProduct = async function() {
    const btn = document.getElementById('btn-submit-product');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    try {
        // Lấy dữ liệu từ Form
        const formData = new FormData();
        formData.append('name', document.getElementById('p-name').value);
        formData.append('short_description', document.getElementById('p-short-desc').value);
        formData.append('description', myEditor ? myEditor.getData() : '');
        formData.append('provider_name', document.getElementById('p-provider').value);
        formData.append('category', document.getElementById('p-category').value);
        formData.append('target_audience', document.getElementById('p-target').value);
        formData.append('base_price', document.getElementById('p-price').value);
        
        // Boolean cần gửi đúng format
        const isHidden = document.getElementById('p-hidden-price').checked;
        formData.append('is_price_hidden', isHidden ? 'True' : 'False');

        // Lấy file ảnh mới
        const fileInput = document.getElementById('p-images');
        if (fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('uploaded_images', fileInput.files[i]);
            }
        }

        let url = '/products/';
        let method = 'POST';

        // Nếu đang sửa thì đổi URL và Method
        if (currentProductId) {
            url = `/products/${currentProductId}/`;
            method = 'PATCH'; // Dùng PATCH để cập nhật một phần
        }

        const res = await fetchAPI(url, method, formData);
        
        // Đóng modal và load lại bảng
        const modalEl = document.getElementById('productModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        Toast.fire({ icon: 'success', title: currentProductId ? 'Cập nhật thành công!' : 'Thêm mới thành công!' });
        loadProducts();

    } catch (e) {
        console.error(e);
        Toast.fire({ icon: 'error', title: 'Có lỗi xảy ra: ' + (e.detail || e.message || 'Lỗi server') });
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Lưu sản phẩm';
    }
}

// --- 6. XỬ LÝ XÓA SẢN PHẨM ---
window.deleteProduct = async function(id) {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) return;

    try {
        await fetchAPI(`/products/${id}/`, 'DELETE');
        Toast.fire({ icon: 'success', title: 'Đã xóa sản phẩm' });
        loadProducts(); // Load lại danh sách
    } catch (e) {
        console.error(e);
        Toast.fire({ icon: 'error', title: 'Không thể xóa sản phẩm' });
    }
}

// --- 7. XỬ LÝ XÓA ẢNH LẺ (TRONG LÚC SỬA) ---
window.deleteImage = async function(productId, imageId, btnElement) {
    if (!confirm("Xóa ảnh này?")) return;
    
    try {
        // Backend cần có API delete_image
        // Nếu backend chưa hỗ trợ xóa lẻ ảnh qua API riêng, bạn có thể cần gửi list ID cần xóa khi update
        // Ở đây giả định dùng endpoint delete_image như trong views.py bạn gửi
        
        await fetchAPI(`/products/${productId}/delete_image/`, 'DELETE', { image_id: imageId });
        
        // Xóa element trên giao diện
        btnElement.parentElement.remove();
        Toast.fire({ icon: 'success', title: 'Đã xóa ảnh' });
    } catch (e) {
        console.error(e);
        Toast.fire({ icon: 'error', title: 'Lỗi xóa ảnh' });
    }
}
