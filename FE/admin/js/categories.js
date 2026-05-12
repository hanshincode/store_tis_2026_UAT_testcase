/**
 * admin/js/categories.js
 * Quản lý danh mục bảo hiểm: Liệt kê, Thêm mới và Xóa danh mục.
 */

// Bảng ánh xạ mã chuyên môn sang tên hiển thị
const specMap = { 
    'property': 'Tài sản', 
    'health': 'Sức khỏe', 
    'vehicle': 'Xe cộ', 
    'marine': 'Hàng hải' 
};

let editingCategoryId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Tải danh sách ngay khi trang sẵn sàng
    loadCategories();
});

// --- CÁC HÀM XỬ LÝ GIAO DIỆN (WINDOW SCOPE) ---

/**
 * Mở Modal thêm/sửa danh mục và làm mới form
 */
window.openCategoryModal = async function(id = null) {
    const form = document.getElementById('category-form');
    const title = document.querySelector('#categoryModal .modal-title');
    if (form) form.reset();
    
    editingCategoryId = id;

    if (id) {
        title.innerText = "Chỉnh sửa danh mục";
        try {
            const cat = await fetchAPI(`/categories/${id}/`);
            document.getElementById('c-name').value = cat.name;
            document.getElementById('c-spec').value = cat.specialization_code;
        } catch (e) {
            Toast.fire({ icon: 'error', title: 'Không thể tải dữ liệu danh mục' });
        }
    } else {
        title.innerText = "Thêm danh mục mới";
    }
    
    const modalEl = document.getElementById('categoryModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

/**
 * Tải danh sách danh mục từ API
 */
window.loadCategories = async function() {
    const tbody = document.getElementById('category-list');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-danger spinner-border-sm"></div> Đang tải...</td></tr>';

    try {
        const cats = await fetchAPI('/categories/'); // Sử dụng fetchAPI từ common.js
        if (!cats || cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Chưa có danh mục nào.</td></tr>';
            return;
        }

        tbody.innerHTML = cats.map(c => `
            <tr>
                <td class="ps-4 text-muted">${c.id}</td>
                <td class="fw-bold text-dark cursor-pointer" onclick="openCategoryModal(${c.id})">${c.name}</td>
                <td><span class="badge bg-light text-dark border font-monospace">${c.slug}</span></td>
                <td>
                    <span class="badge bg-info-subtle text-info border border-info px-3 py-2">
                        <i class="fas fa-user-tag me-1"></i> ${specMap[c.specialization_code] || c.specialization_code}
                    </span>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteCategory(${c.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) { 
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Lỗi kết nối máy chủ.</td></tr>'; 
    }
};

/**
 * Gửi dữ liệu danh mục mới về Backend
 */
window.submitCategory = async function() {
    const nameInput = document.getElementById('c-name');
    const specInput = document.getElementById('c-spec');
    const name = nameInput ? nameInput.value.trim() : '';
    const spec = specInput ? specInput.value : 'health';
    
    if (!name) {
        Toast.fire({ icon: 'warning', title: 'Vui lòng nhập tên danh mục!' });
        return;
    }

    // Payload gửi đi
    const payload = { 
        name: name, 
        specialization_code: spec 
    };

    // Chỉ tạo slug khi thêm mới để tránh trùng lặp nếu BE đã có slug sẵn
    if (!editingCategoryId) {
        payload.slug = name.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-');
    }
    
    const method = editingCategoryId ? 'PATCH' : 'POST';
    const url = editingCategoryId ? `/categories/${editingCategoryId}/` : '/categories/';

    try {
        await fetchAPI(url, method, payload);
        const modalEl = document.getElementById('categoryModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        loadCategories();
        Toast.fire({ icon: 'success', title: editingCategoryId ? 'Cập nhật thành công!' : 'Đã thêm danh mục mới!' });
    } catch(e) { 
        Swal.fire('Lỗi', 'Tên danh mục hoặc đường dẫn Slug đã tồn tại trên hệ thống.', 'error'); 
    }
};

window.deleteCategory = async function(id) {
    const result = await Swal.fire({
        title: 'Xác nhận xóa danh mục?',
        text: "Hành động này không thể hoàn tác!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#D71920'
    });

    if (result.isConfirmed) {
        try {
            await fetchAPI(`/categories/${id}/`, 'DELETE');
            loadCategories();
            Toast.fire({ icon: 'success', title: 'Đã gỡ bỏ danh mục.' });
        } catch(e) { 
            Swal.fire('Lỗi', 'Danh mục này hiện đang có sản phẩm liên kết, không thể xóa.', 'error'); 
        }
    }
};