// admin/js/profile.js

let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadMyProfile();

    document.getElementById('profile-form')?.addEventListener('submit', updateProfile);
    document.getElementById('password-form')?.addEventListener('submit', changePassword);
});

// Load dữ liệu của chính mình
async function loadMyProfile() {
    try {
        const user = await fetchAPI('/users/me/');
        currentUserId = user.id;
        
        document.getElementById('prof-username').value = user.username;
        document.getElementById('prof-name').value = user.first_name || '';
        document.getElementById('prof-email').value = user.email || '';
    } catch (error) {
        console.error(error);
        Toast.fire({ icon: 'error', title: 'Lỗi tải thông tin cá nhân' });
    }
}

// Cập nhật thông tin cơ bản
async function updateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-update-profile');
    btn.disabled = true; btn.innerText = "Đang lưu...";

    const data = {
        first_name: document.getElementById('prof-name').value.trim(),
        email: document.getElementById('prof-email').value.trim()
    };

    try {
        // Dùng phương thức PATCH để update 1 phần dữ liệu
        await fetchAPI(`/users/${currentUserId}/`, 'PATCH', data);
        Toast.fire({ icon: 'success', title: 'Cập nhật thông tin thành công!' });
        
        // Update lại tên hiển thị trên Topbar
        document.getElementById('admin-name').innerText = data.first_name;
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Lỗi cập nhật thông tin' });
    } finally {
        btn.disabled = false; btn.innerText = "Cập nhật thông tin";
    }
}

// Đổi mật khẩu
async function changePassword(e) {
    e.preventDefault();
    
    const oldPass = document.getElementById('old-pass').value;
    const newPass = document.getElementById('new-pass').value;
    const confirmPass = document.getElementById('confirm-pass').value;

    if (newPass !== confirmPass) {
        return Toast.fire({ icon: 'warning', title: 'Mật khẩu xác nhận không khớp!' });
    }
    if (newPass.length < 6) {
        return Toast.fire({ icon: 'warning', title: 'Mật khẩu mới phải từ 6 ký tự!' });
    }

    const btn = document.getElementById('btn-change-password');
    btn.disabled = true; btn.innerText = "Đang xử lý...";

    try {
        // Lưu ý: Endpoint set_password này tùy thuộc vào backend Django của bạn cấu hình.
        // Thường DRF hoặc Djoser sẽ dùng /users/set_password/ hoặc custom trong UserViewSet
        await fetchAPI('/users/set_password/', 'POST', {
            current_password: oldPass,
            new_password: newPass
        });
        
        Toast.fire({ icon: 'success', title: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });
        document.getElementById('password-form').reset();
        
        // Tự động đăng xuất sau 2 giây để bắt buộc login lại bằng pass mới
        setTimeout(() => { window.logout(); }, 2000);

    } catch (error) {
        // Hiển thị lỗi từ backend (vd: Sai mật khẩu cũ)
        let errorMsg = "Lỗi đổi mật khẩu";
        if (error.current_password) errorMsg = "Mật khẩu hiện tại không đúng!";
        Toast.fire({ icon: 'error', title: errorMsg });
    } finally {
        btn.disabled = false; btn.innerText = "Đổi mật khẩu";
    }
}