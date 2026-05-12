// admin/js/staff.js

document.addEventListener('DOMContentLoaded', () => {
    loadStaffList();
    
    document.getElementById('btn-open-add-staff')?.addEventListener('click', () => {
        document.getElementById('staff-form').reset();
        new bootstrap.Modal(document.getElementById('staffModal')).show();
    });

    document.getElementById('btn-submit-staff')?.addEventListener('click', createStaffAccount);
});

async function loadStaffList() {
    const list = document.getElementById('staff-list');
    list.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';
    
    try {
        const staff = await fetchAPI('/users/staff-list/'); // Giả định endpoint lấy danh sách nv
        list.innerHTML = staff.map(s => `
            <tr>
                <td class="fw-bold">${s.username}</td>
                <td>${s.full_name || 'Chưa cập nhật'}</td>
                <td>${s.email || '-'}</td>
                <td>
                    <span class="badge ${s.is_superuser ? 'bg-danger' : 'bg-primary'}">
                        ${s.is_superuser ? 'Admin' : 'Staff'}
                    </span>
                </td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" ${s.is_active ? 'checked' : ''} 
                            onclick="toggleStaffStatus(${s.id}, ${s.is_active})">
                    </div>
                </td>
            </tr>
        `).join('');
    } catch(e) { list.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Chưa có dữ liệu nhân sự</td></tr>'; }
}

async function createStaffAccount() {
    const username = document.getElementById('s-username').value;
    const name = document.getElementById('s-name').value;
    const pass = document.getElementById('s-pass').value;
    const role = document.getElementById('s-role').value;

    if(!username || !pass) return Swal.fire('Lỗi', 'Vui lòng nhập tài khoản và mật khẩu', 'error');

    try {
        await fetchAPI('/users/create-staff/', 'POST', {
            username: username,
            full_name: name,
            password: pass,
            role: role // Backend sẽ xử lý is_staff dựa trên role này
        });

        bootstrap.Modal.getInstance(document.getElementById('staffModal')).hide();
        loadStaffList();
        Swal.fire('Thành công', 'Đã tạo tài khoản nhân sự mới', 'success');
    } catch(e) {
        Swal.fire('Thất bại', e.detail || 'Tài khoản đã tồn tại', 'error');
    }
}

async function toggleStaffStatus(id, currentStatus) {
    try {
        await fetchAPI(`/users/${id}/toggle-status/`, 'POST');
        Toast.fire({ icon: 'success', title: 'Đã cập nhật trạng thái' });
    } catch(e) { loadStaffList(); }
}