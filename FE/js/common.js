/**
 * fontend/js/common.js
 * Chức năng: Cấu hình API, Quản lý JWT (Access/Refresh), Xử lý thông báo,
 * và Tự động bắt lỗi mất kết nối Server có đính kèm chi tiết lỗi.
 */

// --- 1. CẤU HÌNH HỆ THỐNG ---
const DEFAULT_API_DOMAIN = (
    window.location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
)
    ? 'http://127.0.0.1:8000'
    : `${window.location.protocol}//${window.location.hostname}:8000`;

const DOMAIN = window.TIS_API_DOMAIN || localStorage.getItem('tis_api_domain') || DEFAULT_API_DOMAIN;
const API_BASE_URL = `${DOMAIN}/api`;

function frontendPath(path = '') {
    const cleanPath = String(path).replace(/^\/+/, '');
    const isNestedPage = /\/(admin|user)\//.test(window.location.pathname.replace(/\\/g, '/'));
    return `${isNestedPage ? '../' : ''}${cleanPath}`;
}

function apiUrl(endpoint = '') {
    if (String(endpoint).startsWith('http')) return endpoint;
    const cleanEndpoint = String(endpoint).startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
}

function mediaUrl(path) {
    if (!path) return 'https://placehold.co/800x600/f8f9fa/d71920?text=TIS+Broker';
    if (String(path).startsWith('http')) return path;
    const cleanPath = String(path).startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith('/media')) return `${DOMAIN}${cleanPath}`;
    return `${DOMAIN}/media${cleanPath}`;
}

function websocketUrl(path = '') {
    const domainUrl = new URL(DOMAIN);
    const wsProtocol = domainUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const cleanPath = String(path).startsWith('/') ? path : `/${path}`;
    return `${wsProtocol}//${domainUrl.host}${cleanPath}`;
}

function redirectTo(path) {
    window.location.href = frontendPath(path);
}

// --- 2. QUẢN LÝ TOKEN ---
const getAccessToken = () => localStorage.getItem('access_token');
const getRefreshToken = () => localStorage.getItem('refresh_token');

const saveTokens = (access, refresh) => {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
};

const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
};
const removeTokens = clearTokens;

function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.results)) return payload.results;
    return [];
}

function getErrorMessage(error, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error.detail) return error.detail;
    const firstKey = Object.keys(error)[0];
    const firstValue = firstKey ? error[firstKey] : null;
    if (Array.isArray(firstValue)) return firstValue.join(', ');
    if (firstValue) return String(firstValue);
    return fallback;
}

function escapeHTML(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- 3. KHỞI TẠO THÔNG BÁO (SWEETALERT2 SAFE) ---
let Toast = {
    fire: (obj) => console.log(`${obj.icon}: ${obj.title}`) 
};

if (typeof Swal !== 'undefined') {
    Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
} else {
    console.warn("SweetAlert2 chưa được tải. Vui lòng kiểm tra script trong HTML.");
}

// --- 4. HÀM FETCH API TRUNG TÂM ---
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const url = apiUrl(endpoint);
    
    const getOptions = (token) => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const options = { method, headers };

        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        }
        return options;
    };

    try {
        let response = await fetch(url, getOptions(getAccessToken()));

        // XỬ LÝ KHI TOKEN HẾT HẠN (401)
        if (response.status === 401 && getRefreshToken()) {
            console.warn("Access Token hết hạn, đang thực hiện xoay vòng mã thông báo...");
            
            const isRefreshed = await handleRefreshToken();
            if (isRefreshed) {
                response = await fetch(url, getOptions(getAccessToken()));
            } else {
                window.logout();
                return;
            }
        }

        // Xử lý lỗi phân quyền hoặc lỗi dữ liệu (403, 400...)
        if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            const errorData = contentType.includes('application/json')
                ? await response.json()
                : { detail: await response.text() || response.statusText };
            throw errorData; 
        }

        if (response.status === 204 || method === 'DELETE') return { success: true };
        
        return await response.json();

    } catch (error) {
        // [THÊM MỚI] XỬ LÝ LỖI MẠNG HOẶC SERVER SẬP & TRUYỀN MÃ LỖI
        if (error.name === 'TypeError' || 
            (error.message && (error.message.includes('fetch') || error.message.includes('NetworkError')))) {
            console.error("🔥 Báo động: Mất kết nối đến Backend Server!", error);
            
            // Lấy thông báo lỗi và mã hóa để đưa lên URL
            const errorMsg = encodeURIComponent(error.message || "Network Error");
            
            if (!window.location.pathname.includes('server-error.html')) {
                window.location.href = frontendPath(`server-error.html?error=${errorMsg}`);
            }
        }

        console.error(`Lỗi API (${endpoint}):`, error);
        throw error; 
    }
}

// --- 5. LOGIC XOAY VÒNG TOKEN ---
async function handleRefreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
        const res = await fetch(`${API_BASE_URL}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refresh })
        });

        if (res.ok) {
            const data = await res.json();
            saveTokens(data.access, data.refresh);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// --- 6. HÀM KIỂM TRA SỨC KHỎE SERVER NGAY KHI LOAD TRANG ---
async function checkServerHealth() {
    if (window.location.pathname.includes('server-error.html')) return;

    try {
        await fetch(`${API_BASE_URL}/products/?limit=1`, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        if (error.name === 'TypeError' || 
            (error.message && (error.message.includes('fetch') || error.message.includes('NetworkError')))) {
            console.error("🔥 Server Backend không phản hồi từ lúc load trang!");
            
            const errorMsg = encodeURIComponent(error.message || "Connection Failed");
            window.location.href = frontendPath(`server-error.html?error=${errorMsg}`);
        }
    }
}

// --- 7. HÀM TIỆN ÍCH ---
window.logout = function() {
    clearTokens();
    window.location.replace(frontendPath('login.html'));
};

function formatMoney(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

document.addEventListener("DOMContentLoaded", function() {
    // Ping kiểm tra server
    checkServerHealth();

    // Logic Ẩn/Hiện mật khẩu
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');

    togglePasswordButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const inputField = this.closest('.input-group').querySelector('input');
            const icon = this.querySelector('i');

            if (inputField.type === 'password') {
                inputField.type = 'text'; 
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash'); 
                }
            } else {
                inputField.type = 'password'; 
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });
});
