// login.js

function loginWithGoogle() {
    // Điều hướng trình duyệt đến endpoint của Django Backend
    // Địa chỉ này sẽ kích hoạt luồng OAuth2 mà bạn đã cấu hình trong Admin
    window.location.href = `${DOMAIN}/accounts/google/login/`;
}


// Thêm vào login.js
function loginWithMicrosoft() {
    // Điều hướng tới endpoint của Django để bắt đầu luồng OAuth2
    window.location.href = `${DOMAIN}/accounts/microsoft/login/`;
}

document.addEventListener('DOMContentLoaded', () => {
    // Kiểm tra Token trên URL (ví dụ: ?access=...&refresh=...)
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access');
    const refresh = params.get('refresh');

    if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        
        // Dùng hàm có sẵn của bạn để kiểm tra role và vào trang chính
        checkUserRoleAndRedirect();
        return;
    }
    // 1. Nếu đã có Token, kiểm tra quyền để chuyển hướng ngay, không bắt đăng nhập lại
    if (getAccessToken()) {
        checkUserRoleAndRedirect();
    }

    // 2. Lắng nghe sự kiện gửi Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// js/login.js - Bản sửa lỗi Redirection
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        btn.disabled = true;
        btn.innerText = "ĐANG XỬ LÝ...";

        const response = await fetch(`${API_BASE_URL}/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 1. Lưu token trước để fetchAPI có thể hoạt động
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);

            // 2. Gọi API lấy thông tin User thực tế để có trường 'role'
            const user = await fetchAPI('/users/me/'); 
            
            if (user && user.role) {
                localStorage.setItem('user_info', JSON.stringify(user));
                Toast.fire({ icon: 'success', title: 'Đăng nhập thành công!' });
                
                // 3. Chuyển hướng ngay lập tức dựa trên Role thực tế
                setTimeout(() => {
                    const adminRoles = ['super_admin', 'admin', 'staff'];
                    if (adminRoles.includes(user.role)) {
                        redirectTo('admin/index.html');
                    } else {
                        redirectTo('index.html');
                    }
                }, 500);
            }
        } else {
            throw new Error(data.detail || "Sai tài khoản hoặc mật khẩu.");
        }
    } catch (error) {
        Swal.fire('Thất bại', error.message || "Lỗi kết nối hệ thống", 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = "ĐĂNG NHẬP";
    }
}

/**
 * Hàm kiểm tra Role và chuyển hướng (Dành cho trường hợp Refresh trang)
 */
async function checkUserRoleAndRedirect() {
    try {
        // Gọi API lấy thông tin cá nhân để đảm bảo Token còn sống
        const user = await fetchAPI('/users/me/');
        if (user && user.role) {
            localStorage.setItem('user_info', JSON.stringify(user));
            redirectByUserRole(user.role);
        }
    } catch (error) {
        // Nếu Token hỏng hoặc hết hạn hoàn toàn, bắt đăng nhập lại
        localStorage.clear();
    }
}

/**
 * Logic phân vùng truy cập dựa trên Model User
 */
function redirectByUserRole(role) {
    // Danh sách các quyền được vào vùng Quản trị (Admin Panel)
    const adminRoles = ['super_admin', 'admin', 'staff'];
    
    if (adminRoles.includes(role)) {
        redirectTo('admin/index.html');
    } else {
        // Khách hàng hoặc các đối tượng khác về trang chủ FE
        redirectTo('index.html');
    }
}

// Ví dụ logic xử lý sau khi lấy được token từ Google
async function handleSocialLogin(provider, token) {
    const response = await fetch(`${API_BASE_URL}/auth/${provider}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
    });
    const data = await response.json();
    if (response.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        // Chuyển hướng như logic cũ
        checkUserRoleAndRedirect();
    }
}


