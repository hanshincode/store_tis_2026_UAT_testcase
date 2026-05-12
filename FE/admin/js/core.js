/**
 * admin/js/core.js
 * Chức năng: Core Admin - Layout, Auth, Navigation & Realtime Updates
 */

// 1. CHỐNG NHẤP NHÁY: Ẩn giao diện cho đến khi xác thực xong
// document.documentElement.style.display = 'none';

// XÓA DÒNG NÀY: document.documentElement.style.display = 'none';

document.addEventListener('DOMContentLoaded', async () => {
    // A. KIỂM TRA TOKEN
    const token = getAccessToken();
    if (!token) {
        window.location.replace('../login.html'); 
        return;
    }

    // --- 1. LẤY CACHE VÀ VẼ GIAO DIỆN NGAY LẬP TỨC (Không cần đợi API) ---
    let cachedUser = sessionStorage.getItem('admin_user');
    if (cachedUser) {
        try {
            cachedUser = JSON.parse(cachedUser);
            renderAdminLayout(cachedUser); // Vẽ Menu lên màn hình ngay lập tức
            activeCurrentMenu();
        } catch (e) {}
    } else {
        // Nếu lỡ không có cache, hiện tạm Spinner loading cho thân thiện
        document.body.insertAdjacentHTML('afterbegin', '<div id="tis-loader" style="position:fixed;top:0;left:0;width:100%;height:100%;background:#f8f9fa;z-index:9999;display:flex;justify-content:center;align-items:center;"><div class="spinner-border text-danger"></div></div>');
    }

    // --- 2. GỌI API NGẦM ĐỂ XÁC THỰC BẢO MẬT ---
    try {
        const user = await fetchAPI('/users/me/');

        const allowedRoles = ['super_admin', 'admin', 'staff'];
        const hasAccess = user.is_superuser || allowedRoles.includes(user.role);

        if (!hasAccess) {
            alert("Tài khoản của bạn không có quyền truy cập trang quản trị!");
            window.location.replace('../index.html');
            return;
        }

        // Cập nhật lại cache mới nhất từ server
        sessionStorage.setItem('admin_user', JSON.stringify(user));

        // Nếu lúc nãy chưa có cache để vẽ, thì bây giờ có data rồi mới vẽ
        if (!cachedUser) {
            const loader = document.getElementById('tis-loader');
            if (loader) loader.remove();
            renderAdminLayout(user);
            activeCurrentMenu();
        } else if (cachedUser.role !== user.role || cachedUser.id !== user.id) {
            // Nếu phát hiện quyền (role) trên server vừa bị đổi, ép tải lại trang
            window.location.reload();
        }

        // --- 3. CẬP NHẬT SỐ LƯỢNG THÔNG BÁO ---
        updateBadgeCount();
        
        // TẠM TẮT DÒNG NÀY ĐỂ TRÁNH GIẬT TRÌNH DUYỆT NHƯ ĐÃ PHÂN TÍCH
        // setInterval(updateBadgeCount, 10000); 

    } catch (error) {
        console.error("Lỗi xác thực Admin:", error);
        clearTokens();
        window.location.replace('../login.html');
    }
});
/**
 * Render Sidebar và Topbar
 */
function renderAdminLayout(user) {
    const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${user.last_name}+${user.first_name}&background=random`;
    const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.username;
    
    // HTML SIDEBAR
    const sidebarHtml = `
    <nav id="sidebar" class="bg-white shadow-sm sidebar-wrapper">
        <div class="sidebar-brand p-3 border-bottom d-flex align-items-center justify-content-center gap-2">
            <i class="fas fa-shield-alt fa-2x text-danger"></i>
            <div>
                <h5 class="fw-bold text-dark m-0">TIS Admin</h5>
                <small class="text-muted" style="font-size: 0.75rem;">Insurance Broker</small>
            </div>
        </div>
        
        <div class="sidebar-menu p-3">
            <ul class="list-unstyled">
                <li class="menu-label text-muted small fw-bold mb-2">QUẢN LÝ CHUNG</li>
                <li><a href="index.html" id="menu-index" class="nav-link"><i class="fas fa-th-large"></i> Dashboard</a></li>
                <li><a href="orders.html" id="menu-orders" class="nav-link"><i class="fas fa-file-invoice-dollar"></i> Đơn hàng</a></li>
                <li><a href="products.html" id="menu-products" class="nav-link"><i class="fas fa-box-open"></i> Sản phẩm</a></li>
                <li><a href="categories.html" id="menu-categories" class="nav-link"><i class="fas fa-list"></i> Danh mục</a></li>
                
                <li class="menu-label text-muted small fw-bold mt-3 mb-2">KHÁCH HÀNG & SUPPORT</li>
                <li>
                    <a href="consultations.html" id="menu-consultations" class="nav-link">
                        <i class="fas fa-headset"></i> Tư vấn
                        <span class="badge bg-warning text-dark ms-auto" id="sidebar-consult-badge" style="display:none">0</span>
                    </a>
                </li>
                <li>
                    <a href="chat.html" id="menu-chat" class="nav-link d-flex align-items-center">
                        <i class="fab fa-facebook-messenger me-2"></i> Live Chat
                        <span class="badge bg-danger ms-auto" id="sidebar-chat-badge" style="display:none">0</span>
                    </a>
                </li>
                
                <li class="menu-label text-muted small fw-bold mt-3 mb-2">NỘI DUNG & HỆ THỐNG</li>
                <li><a href="news.html" id="menu-news" class="nav-link"><i class="fas fa-newspaper"></i> Tin tức</a></li>
                <li><a href="staff.html" id="menu-staff" class="nav-link"><i class="fas fa-users-cog"></i> Nhân sự</a></li>
                
                </ul>
        </div>

        <div class="sidebar-footer p-3 border-top mt-auto bg-light">
            <div class="d-flex align-items-center gap-2 mb-3 p-2 rounded border bg-white shadow-sm user-profile-btn" 
                 onclick="window.location.href='profile.html'" 
                 title="Xem hồ sơ cá nhân"
                 style="cursor: pointer; transition: all 0.2s ease;">
                 
                <img src="${avatarUrl}" class="rounded-circle border" width="40" height="40" style="object-fit: cover;">
                
                <div class="overflow-hidden flex-grow-1">
                    <div class="fw-bold text-dark text-truncate small" title="${fullName}">${fullName}</div>
                    <div class="text-muted x-small text-truncate">${user.role ? user.role.toUpperCase() : 'ADMIN'}</div>
                </div>
                
                <i class="fas fa-chevron-right text-muted small ms-1"></i>
            </div>

            <button class="btn btn-outline-danger btn-sm w-100" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> Đăng xuất
            </button>
        </div>
    </nav>`;

    // HTML TOPBAR (Mobile Toggle)
    const topbarHtml = `
    <div class="topbar d-md-none bg-white shadow-sm p-3 d-flex justify-content-between align-items-center mb-3 sticky-top">
        <div class="d-flex align-items-center gap-2">
            <i class="fas fa-shield-alt text-danger fa-lg"></i>
            <span class="fw-bold">TIS Panel</span>
        </div>
        <button class="btn btn-light border" onclick="toggleSidebar()">
            <i class="fas fa-bars"></i>
        </button>
    </div>`;

    document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.insertAdjacentHTML('afterbegin', topbarHtml);
    }
    
    // Thêm hiệu ứng hover bằng JS (hoặc CSS)
    const profileBtn = document.querySelector('.user-profile-btn');
    if(profileBtn) {
        profileBtn.addEventListener('mouseenter', () => profileBtn.classList.add('bg-light'));
        profileBtn.addEventListener('mouseleave', () => profileBtn.classList.remove('bg-light'));
    }
}

/**
 * Active menu dựa trên URL
 */
function activeCurrentMenu() {
    const path = window.location.pathname;
    let page = path.split("/").pop();
    if (page === '' || page === 'admin') page = 'index.html';
    const menuId = 'menu-' + page.replace('.html', '');
    
    const activeLink = document.getElementById(menuId);
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('show');
}

window.handleLogout = function() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
        clearTokens();
        sessionStorage.removeItem('admin_user');
        window.location.replace('../login.html');
    }
}

async function updateBadgeCount() {
    try {
        const data = await fetchAPI('/consultations/');
        if (Array.isArray(data)) {
            const newCount = data.filter(item => item.status === 'new').length;
            const consultBadge = document.getElementById('sidebar-consult-badge');
            const chatBadge = document.getElementById('sidebar-chat-badge');
            
            if (consultBadge) {
                consultBadge.innerText = newCount;
                consultBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
            }
            if (chatBadge) {
                chatBadge.innerText = newCount;
                chatBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (e) {}
}


// Gắn vào fe/admin/js/core.js (hoặc layout.js)
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    
    // Tạo kênh lắng nghe thông báo xuyên Tab
    const adminNotifChannel = new BroadcastChannel('admin_chat_notifications');
    
    adminNotifChannel.onmessage = (event) => {
        // Nếu nhận được tín hiệu từ Tab Chat, hiển thị thông báo
        if (document.hidden) {
            const data = event.data;
            const notif = new Notification(`KH: ${data.senderName}`, {
                body: data.messageText || "[Đã gửi một tệp đính kèm]",
                icon: "/fe/images/logo.png"
            });
            
            notif.onclick = function() {
                window.focus();
                this.close();
            };
        }
    };
});