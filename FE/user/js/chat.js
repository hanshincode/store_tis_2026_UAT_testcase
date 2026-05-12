let activeConsultationId = null;
let chatSocket = null; // Thêm biến quản lý Socket
let userInfo = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!getAccessToken()) {
        window.location.href = '../login.html';
        return;
    }
    
    try {
        userInfo = await fetchAPI('/users/me/');
        
        // Thêm chữ await nếu hàm loadConsultations của bạn là hàm async
        await loadConsultations(); 
        
    } catch (e) {
        // TẠM THỜI TẮT CHUYỂN HƯỚNG ĐỂ TÌM LỖI
        console.error("Chi tiết lỗi khiến trang Chat bị văng:", e);
        alert("Có lỗi xảy ra khi tải dữ liệu Chat. Vui lòng nhấn F12 và xem tab Console!");
        // window.location.href = '../login.html'; 
    }
});

// Thêm hàm này vào file chat.js của bạn
// fe/user/js/chat.js

async function loadConsultations() {
    const ticketList = document.getElementById('ticket-list');
    try {
        const data = await fetchAPI('/consultations/'); 
        ticketList.innerHTML = '';
        
        if (!data || data.length === 0) {
            ticketList.innerHTML = '<div class="text-center p-4 text-muted">Bạn chưa có yêu cầu hỗ trợ nào.</div>';
            return;
        }

        data.forEach(item => {
            const isActive = item.id === activeConsultationId ? 'active' : '';
            const statusText = item.status === 'new' ? 'Đang chờ' : (item.status === 'in_progress' ? 'Đang hỗ trợ' : 'Đang hỗ trợ');
            
            // Lấy nội dung tin nhắn mới nhất
            const lastMsgText = item.last_message ? item.last_message.message : 'Bắt đầu cuộc trò chuyện';
            const lastMsgTime = item.last_message ? item.last_message.time : '';

            ticketList.insertAdjacentHTML('beforeend', `
                <div class="chat-ticket ${isActive}" id="ticket-${item.id}" onclick="openChat(${item.id}, '${item.status}')">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong class="text-danger">#${item.id} - Hỗ trợ</strong>
                        <small class="text-muted" style="font-size: 10px;">${lastMsgTime}</small>
                    </div>
                    <div class="text-muted small text-truncate" style="max-width: 100%;">
                        ${lastMsgText}
                    </div>
                    <div class="small mt-1" style="font-size: 11px;">
                        <i class="fas fa-circle ${item.status === 'new' ? 'text-warning' : 'text-success'} me-1" style="font-size: 8px;"></i> 
                        ${statusText}
                    </div>
                </div>
            `);
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách chat:", error);
    }
}

window.openChat = async function(consultationId, status) {
    activeConsultationId = consultationId;
    
    document.getElementById('chat-title').innerText = `Phiên tư vấn #${consultationId}`;
    document.getElementById('chat-status').innerText = status === 'new' ? 'Chuyên viên đang chuẩn bị phản hồi...' : 'Chuyên viên đang hỗ trợ';
    document.getElementById('chat-form').style.display = 'flex';
    
    document.querySelectorAll('.chat-ticket').forEach(el => el.classList.remove('active'));
    document.getElementById(`ticket-${consultationId}`)?.classList.add('active');

    // 1. Tải lịch sử chat cũ bằng API HTTP
    await loadMessagesHistory();
    
    // 2. Kết nối WebSocket (Thay thế cho Polling 3s cũ)
    connectWebSocket(consultationId);
}

// Tách hàm load lịch sử riêng
async function loadMessagesHistory() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div></div>';
    
    try {
        const messages = await fetchAPI(`/consultations/${activeConsultationId}/messages/`, 'GET');
        chatBox.innerHTML = '';
        if (messages.length === 0) {
            chatBox.innerHTML = `<div class="text-center text-muted mt-4">Bắt đầu cuộc trò chuyện.</div>`;
            return;
        }
        messages.forEach(msg => appendMessageToDOM(msg));
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch (e) {
        chatBox.innerHTML = `<div class="text-center text-danger mt-4">Lỗi tải tin nhắn.</div>`;
    }
}

// Hàm kết nối Socket
/**
 * Kết nối WebSocket với Server (Bên Khách hàng)
 * @param {number|string} id - ID của cuộc hội thoại (consultation_id)
 */
function connectWebSocket(id) {
    if (chatSocket) chatSocket.close(); // Đóng kết nối cũ nếu đổi phòng chat

    chatSocket = new WebSocket(websocketUrl(`/ws/chat/${id}/`));

    chatSocket.onmessage = function(e) {
        try {
            const data = JSON.parse(e.data);
            
            // Xử lý sự kiện "Đang gõ"
            if (data.type === 'typing') {
                if (data.is_staff) showTypingIndicator(); 
                return;
            }
            
            if (data.type === 'stop_typing') {
                hideTypingIndicator();
                return;
            }
            
            // Nếu là tin nhắn bình thường
            hideTypingIndicator();
            appendMessageToDOM(data);
            const chatBox = document.getElementById('chat-box');
            chatBox.scrollTop = chatBox.scrollHeight;
            
            // ---> ĐOẠN CODE MỚI THÊM: Bật thông báo nếu tin nhắn NÀY LÀ CỦA ADMIN GỬI
            if (data.is_staff || data.is_staff_reply) {
                showNewMessageNotification(data.sender_name || 'TIS Broker', data.message);
            }
            
        } catch (err) {
            console.error("Lỗi parse tin nhắn:", err);
        }
    };

    chatSocket.onclose = function() {
        console.warn("Mất kết nối WebSocket. Đang thử lại...");
        setTimeout(() => connectWebSocket(id), 3000);
    };
}

// Hàm render UI (Chỉ render khi nhận được từ Server trả về, không render ảo)
// Hàm render UI (Bên User)
function appendMessageToDOM(msg) {
    const chatBox = document.getElementById('chat-box');
    
    // Nhận diện chính xác tin nhắn của ai
    const isStaff = msg.is_staff_reply !== undefined ? msg.is_staff_reply : msg.is_staff;
    const isUser = !isStaff; 
    
    // Xử lý thời gian
    let time = '';
    if (msg.created_at) {
        time = msg.created_at.includes(':') ? msg.created_at : new Date(msg.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    } else {
        time = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    }
    
    // Xóa chữ "Vui lòng chọn..." nếu có
    const emptyText = chatBox.querySelector('.text-muted');
    if (emptyText && emptyText.textContent.includes('chọn một yêu cầu')) emptyText.remove();

    // --- BẮT ĐẦU XỬ LÝ NỘI DUNG (TEXT VÀ FILE) ---
    let contentHtml = '';
    
    // 1. Xử lý text
    if (msg.message) {
        const safeText = msg.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        contentHtml += `<div>${safeText.replace(/\n/g, '<br>')}</div>`;
    }

    // 2. Xử lý File đính kèm
    if (msg.attachment_url) {
        const attachmentUrl = mediaUrl(msg.attachment_url);
        const marginClass = msg.message ? 'mt-2' : ''; 
        if (msg.attachment_type === 'image') {
            // Nếu là hình ảnh
            contentHtml += `
                <div class="${marginClass}">
                    <a href="${attachmentUrl}" target="_blank" title="Bấm để xem ảnh lớn">
                        <img src="${attachmentUrl}" alt="Image" style="max-width: 220px; max-height: 250px; border-radius: 8px; object-fit: cover; display: block;">
                    </a>
                </div>`;
        } else {
            // Nếu là tệp thông thường (PDF, DOCX...)
            const linkColor = isUser ? 'text-white' : 'text-danger';
            const bgStyle = isUser ? 'background: rgba(255,255,255,0.2);' : 'background: rgba(0,0,0,0.05);';
            contentHtml += `
                <div class="${marginClass} p-2 rounded d-flex align-items-center gap-2" style="${bgStyle}">
                    <i class="fas fa-file-alt fs-4 ${linkColor}"></i>
                    <a href="${attachmentUrl}" target="_blank" class="${linkColor} text-decoration-none fw-bold" style="font-size: 0.85rem;">
                        Tệp đính kèm
                    </a>
                </div>`;
        }
    }
    
    // Fallback nếu không có cả chữ lẫn tệp
    if (!contentHtml) contentHtml = '<i style="opacity: 0.8;">[Tệp đính kèm]</i>';
    // --- KẾT THÚC XỬ LÝ NỘI DUNG ---

    // Vẽ bong bóng chat ra màn hình
    chatBox.insertAdjacentHTML('beforeend', `
        <div class="d-flex flex-column animate-fade-in w-100">
            <div class="msg-bubble ${isUser ? 'msg-user' : 'msg-staff'} shadow-sm">
                ${contentHtml}
            </div>
            <small class="text-muted ${isUser ? 'text-end' : 'text-start'} mb-3" style="font-size: 0.65rem; margin-top: -10px; padding: 0 5px;">
                ${isUser ? 'Bạn' : 'TIS Broker'} • ${time}
            </small>
        </div>
    `);
    
    // Tự động cuộn xuống cuối
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Gửi tin nhắn qua WebSocket thay vì HTTP API
window.sendMessage = function(e) {
    e.preventDefault();
    if (!activeConsultationId || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    // Gửi nội dung tin nhắn lên
    chatSocket.send(JSON.stringify({
        message: text,
        sender_id: userInfo.id,
        sender_name: `${userInfo.last_name} ${userInfo.first_name}`.trim(),
        is_staff: false
    }));

    // BÁO CHO SERVER BIẾT KHÁCH ĐÃ GÕ XONG
    if (typingSent) {
        chatSocket.send(JSON.stringify({ type: 'stop_typing', is_staff: false }));
        typingSent = false; // Reset lại cờ
    }

    input.value = '';
    input.focus();
}


// =========================================================
// PHẦN BỔ SUNG Ở CUỐI FILE: HIỆU ỨNG ĐANG GÕ BÊN KHÁCH HÀNG
// =========================================================

let typingSent = false;

// 1. Bắt sự kiện khi Khách hàng gõ phím để báo cho Admin
// =========================================================
// TÍNH NĂNG UPLOAD FILE & ẢNH
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tạo một thẻ input file ẩn và nhét vào body
    document.body.insertAdjacentHTML('beforeend', `
        <input type="file" id="chat-file-upload" style="display: none;" accept="image/*, .pdf, .doc, .docx, .xls, .xlsx">
    `);

    const fileInput = document.getElementById('chat-file-upload');

    // 2. Gắn sự kiện click cho các icon Thêm file / Gửi ảnh
    const attachIcons = document.querySelectorAll('.fa-plus-circle, .fa-image');
    attachIcons.forEach(icon => {
        // Chỉ khi có sẵn một phòng chat đang mở mới cho phép bấm
        icon.addEventListener('click', () => {
            if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
                alert("Vui lòng kết nối vào phòng chat trước khi gửi file!");
                return;
            }
            fileInput.click();
        });
    });

    // 3. Xử lý khi người dùng đã chọn file xong
    fileInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;

        // Reset value để có thể chọn lại file giống hệt sau đó
        this.value = '';

        // Có thể chặn dung lượng file tại đây (ví dụ: tối đa 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("File quá lớn. Vui lòng chọn file dưới 5MB.");
            return;
        }

        // Bật loading nhỏ để user biết đang tải file
        const msgInput = document.getElementById('msg-input');
        const oldPlaceholder = msgInput.placeholder;
        msgInput.placeholder = "Đang tải file lên...";
        msgInput.disabled = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(apiUrl('/chat/upload/'), {
                method: 'POST',
                headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
                body: formData
                // Khuyên dùng: Nếu API của bạn cần Token, hãy thêm headers Authorization vào đây
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Không thể tải file lên hệ thống.");
            }

            if (data.attachment_url) {
                // Xác định định danh là Admin hay User để gửi WS
                // (currentUser cho Admin, userInfo cho User)
                const isStaff = typeof currentUser !== 'undefined' && currentUser !== null;
                const senderId = isStaff ? currentUser.id : userInfo.id;
                const senderName = isStaff ? undefined : `${userInfo.last_name} ${userInfo.first_name}`.trim();

                // 4. Phát sóng URL qua WebSocket
                chatSocket.send(JSON.stringify({
                    'message': '', // Tin nhắn trống
                    'sender_id': senderId,
                    'sender_name': senderName,
                    'is_staff': isStaff,
                    'attachment_url': data.attachment_url,
                    'attachment_type': data.attachment_type
                }));
            } else {
                alert("Không nhận được phản hồi file từ Server.");
            }
        } catch (error) {
            console.error("Lỗi upload file:", error);
            alert("Đã xảy ra lỗi khi tải file lên hệ thống.");
        } finally {
            // Tắt loading
            msgInput.placeholder = oldPlaceholder;
            msgInput.disabled = false;
            msgInput.focus();
        }
    });
});

// 2. Hàm vẽ hiệu ứng "Admin đang gõ..." lên màn hình Khách
let typingTimeout = null;

function showTypingIndicator() {
    clearTimeout(typingTimeout);
    const box = document.getElementById('chat-box'); // Bên User dùng id là chat-box
    let indicator = box.querySelector('.typing-indicator-wrapper');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'typing-indicator-wrapper d-flex flex-column animate-fade-in';
        // Dùng class msg-staff để bong bóng màu xám, nằm bên trái (giống hệt tin nhắn của Admin)
        indicator.innerHTML = `
            <div class="msg-bubble msg-staff shadow-sm d-flex align-items-center gap-1" style="padding: 12px 16px; margin-bottom: 15px;">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
        `;
        box.appendChild(indicator);
        box.scrollTop = box.scrollHeight;
    }
}

// 3. Hàm ẩn hiệu ứng
function hideTypingIndicator() {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        const indicator = document.querySelector('.typing-indicator-wrapper');
        if (indicator) indicator.remove();
    }, 200); // Đợi 200ms để tránh bị giật nháy nếu admin gõ liên tục
}

// 4. Nhúng CSS Animation cho dấu 3 chấm nhảy múa
const style = document.createElement('style');
style.innerHTML = `
    .animate-fade-in { animation: fadeIn 0.3s ease-in; } 
    @keyframes fadeIn { 
        from { opacity:0; transform: translateY(10px); } 
        to { opacity:1; transform: translateY(0); } 
    }
    .typing-indicator-wrapper .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #8e8e8e;
        display: inline-block;
        animation: typing 1.4s infinite;
    }
    .typing-indicator-wrapper .dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator-wrapper .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);


// =========================================================
// CHỨC NĂNG BẬT THÔNG BÁO POPUP & BÁO "ĐANG GÕ..." (CHO USER)
// =========================================================

// 1. Yêu cầu quyền thông báo khi mở trang
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

// 2. Hàm hiển thị thông báo trình duyệt
function showNewMessageNotification(senderName, messageText) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    if (document.hidden) {
        const bodyText = messageText ? messageText : "[Đã gửi một tệp đính kèm]";
        const notification = new Notification(`Tin nhắn mới từ ${senderName}`, {
            body: bodyText,
            icon: "/fe/images/logo.png" 
        });

        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

// 3. Bắt sự kiện Khách hàng đang gõ phím
document.addEventListener('DOMContentLoaded', () => {
    const msgInput = document.getElementById('msg-input');
    if (msgInput) {
        let typingTimer;
        msgInput.addEventListener('input', () => {
            if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

            if (!typingSent) {
                typingSent = true;
                chatSocket.send(JSON.stringify({
                    type: 'typing',
                    sender_id: userInfo.id,
                    is_staff: false
                }));
            }

            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                typingSent = false;
                chatSocket.send(JSON.stringify({
                    type: 'stop_typing',
                    is_staff: false
                }));
            }, 2000);
        });
    }
});
