// admin/js/admin-products.js
let editor; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Khởi tạo CKEditor giống Word như hình bạn gửi
    if (document.getElementById('prod-content')) {
        editor = CKEDITOR.replace('prod-content', {
            height: 450,
            language: 'vi',
            extraPlugins: 'colorbutton,font,justify,table,image2',
            toolbar: [
                { name: 'styles', items: [ 'Font', 'FontSize', 'Format' ] },
                { name: 'basicstyles', items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'TextColor', 'BGColor' ] },
                { name: 'paragraph', items: [ 'NumberedList', 'BulletedList', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock' ] },
                { name: 'insert', items: [ 'Image', 'Table', 'HorizontalRule' ] },
                { name: 'tools', items: [ 'Maximize' ] }
            ]
        });
    }

    loadCategories();
    loadProducts();
});

async function loadCategories() {
    try {
        const cats = await fetchAPI('/categories/');
        const select = document.getElementById('prod-category');
        select.innerHTML = '<option value="">-- Chọn danh mục --</option>' + 
            cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

async function loadProducts() {
    const tbody = document.getElementById('product-table-body');
    try {
        const products = await fetchAPI('/products/');
        tbody.innerHTML = products.map((p, index) => `
            <tr>
                <td class="ps-3">${index + 1}</td>
                <td><img src="${p.images?.[0]?.image || ''}" class="product-img-td" onerror="this.src='https://via.placeholder.com/50'"></td>
                <td class="fw-bold">${p.name}</td>
                <td><span class="badge bg-light text-dark border">${p.category_name || 'Chưa rõ'}</span></td>
                <td class="text-danger fw-bold">${formatMoney(p.base_price)}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-primary" onclick="openModal(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Lỗi tải dữ liệu</td></tr>'; }
}

function openModal(id = null) {
    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('prod-id').value = id || '';
    document.getElementById('img-preview').classList.add('d-none');
    if(editor) editor.setData('');
    document.getElementById('modalTitle').innerText = id ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới';

    if (id) {
        fetchAPI(`/products/${id}/`).then(p => {
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-category').value = p.category;
            document.getElementById('prod-price').value = p.base_price;
            document.getElementById('prod-desc').value = p.description || '';
            if(editor) editor.setData(p.content || '');
            if (p.images?.length > 0) {
                const preview = document.getElementById('img-preview');
                preview.src = p.images[0].image;
                preview.classList.remove('d-none');
            }
        });
    }
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

// HÀM LƯU SỬ DỤNG FORMDATA ĐỂ GỬI ẢNH
async function handleSave() {
    const id = document.getElementById('prod-id').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('prod-name').value);
    formData.append('category', document.getElementById('prod-category').value);
    formData.append('base_price', document.getElementById('prod-price').value);
    formData.append('description', document.getElementById('prod-desc').value);
    if(editor) formData.append('content', editor.getData());

    const file = document.getElementById('prod-image').files[0];
    if (file) formData.append('uploaded_images', file);

    try {
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `/products/${id}/` : '/products/';
        await fetchAPI(url, method, formData);
        
        Toast.fire({ icon: 'success', title: 'Thành công!' });
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        loadProducts();
    } catch (e) { Swal.fire('Lỗi', 'Không thể lưu dữ liệu sản phẩm', 'error'); }
}

async function deleteProduct(id) {
    if(!confirm('Xóa sản phẩm này?')) return;
    try {
        await fetchAPI(`/products/${id}/`, 'DELETE');
        loadProducts();
        Toast.fire({ icon: 'success', title: 'Đã xóa' });
    } catch (e) { Swal.fire('Lỗi', 'Không thể xóa', 'error'); }
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('img-preview');
            preview.src = e.target.result;
            preview.classList.remove('d-none');
        };
        reader.readAsDataURL(input.files[0]);
    }
}