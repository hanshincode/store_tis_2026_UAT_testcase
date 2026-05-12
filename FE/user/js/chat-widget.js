/**
 * TIS System - Chat Widget cho Khách hàng (User)
 * Phiên bản: Đã tắt chức năng gửi file (Guest Upload Disabled)
 */

// =========================================================
// 1. CHỨC NĂNG THÔNG BÁO POPUP (GLOBAL)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

function showGlobalNotification(senderName, messageText) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const chatWindow = document.getElementById('chat-widget-window'); 
    const isWidgetClosed = chatWindow ? chatWindow.classList.contains('d-none') : true;

    // Chỉ thông báo khi tab bị ẩn hoặc khung chat đang đóng
    if (document.hidden || isWidgetClosed) {
        const notif = new Notification(`Tin nhắn từ ${senderName}`, {
            body: messageText || "[Đã gửi một tệp đính kèm]",
            icon: "/fe/images/logo.png" 
        });

        notif.onclick = function() {
            window.focus();
            if (chatWindow && isWidgetClosed) {
                chatWindow.classList.remove('d-none');
            }
            this.close();
        };
    }
}

// =========================================================
// 2. KHỞI TẠO CHAT WIDGET
// =========================================================
function initChatWidget() {
    if (window.__chatWidgetInitialized) return;
    window.__chatWidgetInitialized = true;

    console.log("Chat Widget đã khởi chạy (Đã tắt Upload File)");

    // Cấu hình kết nối
    // Biến trạng thái
    let chatSocket = null;
    let reconnectTimer = null;
    let consultationId = localStorage.getItem('current_consultation_id');
    let customerName = localStorage.getItem('chat_customer_name') || "Khách hàng";

    // Lắng nghe sự kiện toàn cục
    attachEventListeners();

    // Kiểm tra trạng thái phiên làm việc khi load trang
    checkCurrentSession();

    // =========================================================
    // CÁC HÀM XỬ LÝ SỰ KIỆN (EVENTS)
    // =========================================================
    function attachEventListeners() {
        document.addEventListener('click', handleClicks);
        document.addEventListener('submit', handleForms);
        
        // BỔ SUNG: LƯU TẠM DỮ LIỆU KHI KHÁCH ĐANG GÕ 
        document.addEventListener('input', (e) => {
            if (e.target.id === 'chat-customer-name') sessionStorage.setItem('tmp_chat_name', e.target.value);
            if (e.target.id === 'chat-customer-phone') sessionStorage.setItem('tmp_chat_phone', e.target.value);
            if (e.target.id === 'chat-customer-note') sessionStorage.setItem('tmp_chat_note', e.target.value);
        });

        // Khôi phục lại chữ nếu khách lỡ F5
        const n = document.getElementById('chat-customer-name');
        const p = document.getElementById('chat-customer-phone');
        const nt = document.getElementById('chat-customer-note');
        if (n && sessionStorage.getItem('tmp_chat_name')) n.value = sessionStorage.getItem('tmp_chat_name');
        if (p && sessionStorage.getItem('tmp_chat_phone')) p.value = sessionStorage.getItem('tmp_chat_phone');
        if (nt && sessionStorage.getItem('tmp_chat_note')) nt.value = sessionStorage.getItem('tmp_chat_note');

        // Sự kiện gõ phím Enter để gửi tin nhắn
        document.addEventListener('keypress', (e) => {
            if (e.target && e.target.id === 'chat-widget-input-text' && e.key === 'Enter') {
                e.preventDefault();
                sendTextMessage();
            }
        });
    }

    function handleClicks(e) {
        // Mở/Đóng Widget
        const launcherBtn = e.target.closest('#chat-widget-btn') || e.target.closest('#chatIcon');
        if (launcherBtn) {
            e.preventDefault();
            const widgetWindow = document.getElementById('chat-widget-window');
            if (widgetWindow) {
                widgetWindow.classList.toggle('d-none');
                if (!widgetWindow.classList.contains('d-none')) checkCurrentSession();
            }
            return;
        }

        // Tắt Widget
        const closeBtn = e.target.closest('#close-chat-btn');
        if (closeBtn) {
            e.preventDefault();
            document.getElementById('chat-widget-window')?.classList.add('d-none');
            return;
        }

        // Nút Gửi Tin Nhắn
        const sendBtn = e.target.closest('#chat-widget-send-btn');
        if (sendBtn) {
            e.preventDefault();
            sendTextMessage();
            return;
        }

        // Đã xóa chức năng nút Đính kèm ở đây
    }

    async function handleForms(e) {
        const startForm = e.target.closest('#start-consultation-form');
        if (!startForm) return;

        e.preventDefault();

        const name = document.getElementById('chat-customer-name')?.value.trim();
        const phone = document.getElementById('chat-customer-phone')?.value.trim();
        const note = document.getElementById('chat-customer-note')?.value.trim() || '';
        const submitBtn = startForm.querySelector('button[type="submit"]');

        if (!name || !phone) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang kết nối...';

        try {
            const payloadData = {
                customer_name: name,
                customer_contact: phone, 
                note: note,
                status: 'new'
            };

            const res = await fetch(apiUrl('/consultations/'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadData)
            });

            if (!res.ok) throw new Error("Lỗi API khởi tạo chat");

            const data = await res.json();
            if (data.id) {
                consultationId = String(data.id);
                customerName = name;
                localStorage.setItem('current_consultation_id', consultationId);
                localStorage.setItem('chat_customer_name', customerName);

                // Xóa cache session sau khi gửi thành công
                sessionStorage.removeItem('tmp_chat_name');
                sessionStorage.removeItem('tmp_chat_phone');
                sessionStorage.removeItem('tmp_chat_note');

                startForm.reset();
                checkCurrentSession();
            }
        } catch (err) {
            console.error(err);
            alert("Không thể bắt đầu chat. Vui lòng thử lại sau.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Bắt đầu chat';
        }
    }

    // =========================================================
    // XỬ LÝ WEBSOCKET & DỮ LIỆU
    // =========================================================
    function checkCurrentSession() {
        const formView = document.getElementById('chat-widget-form');
        const conversationView = document.getElementById('chat-widget-conversation');

        if (!formView || !conversationView) return;

        if (consultationId) {
            formView.classList.add('d-none');
            conversationView.classList.remove('d-none');
            conversationView.classList.add('d-flex');

            if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
                connectWebSocket(consultationId);
                fetchChatHistory(consultationId);
            }
        } else {
            formView.classList.remove('d-none');
            conversationView.classList.add('d-none');
            conversationView.classList.remove('d-flex');
        }
    }

    function connectWebSocket(id) {
        if (chatSocket) chatSocket.close();
        
        const wsUrl = websocketUrl(`/ws/chat/${id}/`);
        chatSocket = new WebSocket(wsUrl);

        chatSocket.onopen = () => console.log("WebSocket Widget Đã kết nối");

        chatSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            
            // Bỏ qua sự kiện typing
            if (data.type === 'typing' || data.type === 'stop_typing') return;
            
            appendWidgetMessage(data);

            // Bật thông báo nếu tin nhắn từ Admin/Staff
            if (data.is_staff || data.is_staff_reply) {
                showGlobalNotification(data.sender_name || 'TIS Broker', data.message);
            }
        };

        chatSocket.onclose = () => {
            console.warn('Mất kết nối WebSocket. Đang thử lại...');
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
                const widgetWindow = document.getElementById('chat-widget-window');
                if (widgetWindow && !widgetWindow.classList.contains('d-none') && consultationId) {
                    connectWebSocket(consultationId);
                }
            }, 3000);
        };
    }

    async function fetchChatHistory(id) {
        try {
            const res = await fetch(apiUrl(`/consultations/${id}/messages/`));
            if (!res.ok) return;

            const msgs = await res.json();
            const msgBox = document.getElementById('chat-widget-messages');

            if (Array.isArray(msgs) && msgs.length > 0 && msgBox) {
                msgBox.innerHTML = '';
                msgs.forEach(m => appendWidgetMessage(m));
            }
        } catch (e) {
            console.error("Lỗi lấy lịch sử chat:", e);
        }
    }

    // =========================================================
    // XỬ LÝ GIAO DIỆN (UI)
    // =========================================================
    function appendWidgetMessage(data) {
        const msgBox = document.getElementById('chat-widget-messages');
        if (!msgBox) return;

        const isMe = !data.is_staff_reply;
        let contentHtml = '';

        if (data.message) {
            const safeText = data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            contentHtml += `<div style="line-height: 1.4;">${safeText.replace(/\n/g, '<br>')}</div>`;
        }

        // Vẫn giữ code hiển thị file đính kèm để khách xem được file Admin gửi
        if (data.attachment_url) {
            const fileUrl = mediaUrl(data.attachment_url);
            if (data.attachment_type === 'image') {
                contentHtml += `<div class="${data.message ? 'mt-2' : ''}"><a href="${fileUrl}" target="_blank"><img src="${fileUrl}" style="max-width: 180px; max-height: 200px; object-fit: cover; border-radius: 8px;"></a></div>`;
            } else {
                const textColor = isMe ? '#fff' : '#D71920';
                contentHtml += `
                    <div class="${data.message ? 'mt-2' : ''} p-2 rounded d-flex align-items-center gap-2" style="background: rgba(0,0,0,0.08);">
                        <i class="fas fa-file-alt" style="color: ${textColor};"></i>
                        <a href="${fileUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500; font-size: 0.85rem;">Xem tệp đính kèm</a>
                    </div>`;
            }
        }

        const alignClass = isMe ? 'justify-content-end' : 'justify-content-start';
        const bubbleClass = isMe ? 'widget-bubble-me' : 'widget-bubble-staff';
        const timeAlign = isMe ? 'text-end' : 'text-start';
        
        const avatarHtml = !isMe ? `
            <div class="widget-avatar me-2 mt-auto mb-1 flex-shrink-0">
                <img src="/fe/images/logo_tab.png" alt="TIS" width="28" height="28">
            </div>` : '';

        const staffNameHtml = !isMe ? `<small class="text-muted mb-1" style="font-size: 0.7rem; margin-left: 2px;">${data.sender_name || 'TIS Broker'}</small>` : '';
        const timeStr = data.created_at ? (data.created_at.includes('T') ? new Date(data.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : data.created_at) : new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});

        const html = `
            <div class="d-flex w-100 ${alignClass} mb-3 animate-fade-in">
                ${avatarHtml}
                <div class="d-flex flex-column align-items-${isMe ? 'end' : 'start'}" style="max-width: 85%;">
                    ${staffNameHtml}
                    <div class="${bubbleClass} shadow-sm">${contentHtml}</div>
                    <div class="text-muted mt-1 ${timeAlign}" style="font-size: 0.65rem;">${timeStr}</div>
                </div>
            </div>`;

        const initialText = msgBox.querySelector('.text-center.text-muted');
        if (initialText) initialText.remove();

        msgBox.insertAdjacentHTML('beforeend', html);
        msgBox.scrollTo({ top: msgBox.scrollHeight, behavior: 'smooth' });
    }

    // =========================================================
    // XỬ LÝ GỬI TIN NHẮN TEXT 
    // =========================================================
    function sendTextMessage() {
        const inputEl = document.getElementById('chat-widget-input-text');
        if (!inputEl) return;

        const text = inputEl.value.trim();
        if (text && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(JSON.stringify({
                message: text,
                sender_name: customerName,
                is_staff: false
            }));
            inputEl.value = '';
            inputEl.focus();
        }
    }
}

// Khởi chạy an toàn
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatWidget);
} else {
    initChatWidget();
}
