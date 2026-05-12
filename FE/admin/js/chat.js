/**
 * frontend/admin/js/chat.js
 * Chức năng: WebSocket Chat Client cho Admin
 */

let currentConsultationId = null;
let chatSocket = null;
let currentUser = null;
let reconnectInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Lấy thông tin Admin đang đăng nhập
    try {
        currentUser = await fetchAPI('/users/me/');
        if (!['admin', 'super_admin', 'staff'].includes(currentUser.role) && !currentUser.is_superuser) {
            alert("Không có quyền truy cập");
            window.location.href = 'index.html';
            return;
        }
    } catch (e) {
        window.location.href = '../login.html';
        return;
    }

    // 2. Lấy ID từ URL (nếu bấm từ trang consultations chuyển sang)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

// 3. Tải danh sách
    loadConversations(id);
    
    // 4. Bắt sự kiện tìm kiếm trên sidebar
    setupSearchListener();
    
    // 5. BẮT SỰ KIỆN FILTER TAB (Thêm dòng này)
    setupFilterListeners();
});

// Setup search functionality
function setupSearchListener() {
    const searchInput = document.querySelector('.msgr-search-container input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value.toLowerCase());
        });
    }
}

function filterConversations(query) {
    const items = document.querySelectorAll('.msgr-item');
    items.forEach(item => {
        const name = item.querySelector('.customer-name');
        if (name && name.textContent.toLowerCase().includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// --- 1. QUẢN LÝ DANH SÁCH HỘI THOẠI ---
async function loadConversations(activeId) {
    const listEl = document.getElementById('conv-list');
    try {
        const data = await fetchAPI('/consultations/'); 
        
        if (!data || data.length === 0) {
            listEl.innerHTML = '<div class="text-center text-muted mt-5">Chưa có yêu cầu nào.</div>';
            return;
        }

        listEl.innerHTML = data.map(item => {
            const isActive = item.id == activeId ? 'active' : '';
            const lastMsg = item.last_message ? item.last_message.message : 'Chưa có tin nhắn';
            const relativeTime = getRelativeTime(item.last_message?.created_at || item.created_at);
            const avatarLetter = item.customer_name ? item.customer_name.charAt(0).toUpperCase() : 'K';
            
            // XÁC ĐỊNH LOẠI KHÁCH HÀNG (Thành viên hay Vãng lai)
            const isMember = item.user !== null && item.user !== undefined;
            const userType = isMember ? 'user' : 'guest';
            
            // TẠO BADGE HTML
            const badgeHtml = isMember 
                ? '<span class="badge badge-member ms-1">Thành viên</span>'
                : '<span class="badge badge-guest ms-1">Vãng lai</span>';
            
            // Thêm data-user-type và data-status vào div để Lọc (Filter)
            return `
            <div class="msgr-item ${isActive}" 
                 onclick="openChat(${item.id}, '${item.customer_name}', '${item.customer_contact || ''}', '${item.note || ''}')" 
                 id="conv-item-${item.id}" 
                 data-conversation-id="${item.id}"
                 data-user-type="${userType}"
                 data-status="${item.status}">
                <div class="msgr-avatar">${avatarLetter}</div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-dark text-truncate customer-name" style="max-width: 140px;">
                            ${item.customer_name} ${badgeHtml}
                        </span>
                        <small class="text-muted" style="font-size:0.75rem" title="${new Date(item.last_message?.created_at || item.created_at).toLocaleString('vi-VN')}">${relativeTime}</small>
                    </div>
                    <div class="text-muted small text-truncate" id="last-msg-${item.id}">${lastMsg}</div>
                </div>
            </div>`;
        }).join('');

        // Mở lại đoạn chat đang active (nếu có)
        if (activeId) {
            const activeItem = data.find(i => i.id == activeId);
            if(activeItem) openChat(activeId, activeItem.customer_name, activeItem.customer_contact, activeItem.note);
        }

        // Tự động áp dụng bộ lọc hiện tại (mặc định sẽ ẩn các tin đã Lưu trữ)
        const activeFilterBtn = document.querySelector('.msgr-tabs .filter-btn.active');
        const currentFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
        if (typeof filterConversationsByStatus === "function") {
            filterConversationsByStatus(currentFilter);
        }

    } catch (e) { 
        console.error("Lỗi tải hội thoại", e);
        listEl.innerHTML = '<div class="text-danger text-center mt-3">Lỗi tải dữ liệu</div>';
    }
}


// Thêm hàm này vào file chat.js
function setupFilterListeners() {
    const filterBtns = document.querySelectorAll('.msgr-tabs .filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 1. Cập nhật giao diện của các nút tab
            filterBtns.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-light');
            });
            e.target.classList.remove('btn-light');
            e.target.classList.add('active', 'btn-primary');

            // 2. Lấy giá trị filter đang được chọn (all, guest, user)
            const filterType = e.target.getAttribute('data-filter');
            const items = document.querySelectorAll('.msgr-item');

            // 3. Ẩn/Hiện các hội thoại tương ứng
            items.forEach(item => {
                // Nếu đang dùng ô tìm kiếm text, cần reset lại ô tìm kiếm
                const searchInput = document.querySelector('.msgr-search-container input');
                if (searchInput) searchInput.value = '';

                if (filterType === 'all') {
                    item.style.display = 'flex';
                } else {
                    if (item.getAttribute('data-user-type') === filterType) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });
    });
}


// --- 2. MỞ CHAT VÀ KẾT NỐI WEBSOCKET ---
async function openChat(id, name, contact, note) {
    if (currentConsultationId === id) return; 

    // Đóng kết nối cũ nếu có
    if (chatSocket) {
        chatSocket.close();
        clearInterval(reconnectInterval);
    }
    
    currentConsultationId = id;

    // Cập nhật Header UI (Tên, Avatar)
    document.getElementById('header-name').innerText = name || 'Khách hàng';
    document.getElementById('header-avatar').innerText = name ? name.charAt(0).toUpperCase() : 'K';
    
    // Xử lý thông tin SĐT và Ghi chú để tránh lỗi "null"
    let extraInfo = '';
    const safeContact = contact && contact !== 'null' && contact !== 'undefined' ? contact : '';
    const safeNote = note && note !== 'null' && note !== 'undefined' ? note : '';

    if (safeContact) {
        extraInfo += `<i class="fas fa-phone-alt ms-3 text-success"></i> ${safeContact} `;
    }
    if (safeNote) {
        extraInfo += `<i class="fas fa-sticky-note ms-2 text-warning"></i> <span title="${safeNote}">${safeNote.substring(0, 25)}${safeNote.length > 25 ? '...' : ''}</span>`;
    }
    
    // Gắn thông tin SĐT / Ghi chú vào Header
    let infoDiv = document.getElementById('header-extra-info');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'header-extra-info';
        infoDiv.className = 'text-muted mt-1';
        infoDiv.style.fontSize = '0.8rem';
        document.getElementById('header-name').parentNode.appendChild(infoDiv);
    }
    infoDiv.innerHTML = extraInfo;

    // HIỂN THỊ CÁC KHU VỰC CHỨC NĂNG
    document.getElementById('input-area').style.display = 'flex'; // Khung gõ chat
    const headerActions = document.getElementById('header-actions');
    if (headerActions) headerActions.style.display = 'block'; // Hiện icon Lưu trữ

    updateStatus('connecting'); 
    
    // Tải lịch sử và kết nối WebSocket
    fetchHistory(id);
    connectWebSocket(id);

    // Cập nhật giao diện danh sách bên trái (in đậm người đang chat)
    document.querySelectorAll('.msgr-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`conv-item-${id}`);
    if (activeItem) activeItem.classList.add('active');

    // Khởi tạo sự kiện cho nút "Lưu trữ" vừa được hiển thị
    if (typeof setupArchiveListener === "function") {
        setupArchiveListener();
    }
}

function connectWebSocket(id) {
    const wsUrl = websocketUrl(`/ws/chat/${id}/`); 

    console.log("Đang kết nối WebSocket tới:", wsUrl);

    if (chatSocket) {
        chatSocket.close();
    }

    chatSocket = new WebSocket(wsUrl);

    chatSocket.onopen = function(e) {
        console.log("WebSocket kết nối thành công!");
        updateStatus('online'); 
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    chatSocket.onmessage = function(e) {
        try {
            const data = JSON.parse(e.data);
            
            switch(data.type) {
                case 'typing':
                    if (!data.is_staff) showTypingIndicator(); 
                    break;
                case 'stop_typing':
                    if (!data.is_staff) hideTypingIndicator(); 
                    break;
                default:
                    hideTypingIndicator(); 
                    appendMessage(data); 
                    
                    const lastMsgEl = document.getElementById(`last-msg-${id}`);
                    if (lastMsgEl) {
                        lastMsgEl.innerText = data.message || '[Tệp đính kèm]';
                    }

                    // Bật thông báo nếu tin nhắn NÀY LÀ CỦA KHÁCH GỬI
                    if (!data.is_staff && !data.is_staff_reply) {
                        if (typeof showNewMessageNotification === "function") {
                            showNewMessageNotification(data.sender_name || 'Khách hàng', data.message);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error("Lỗi xử lý dữ liệu JSON:", err);
        }
    };

    chatSocket.onclose = function(e) {
        console.warn("WebSocket đã đóng.", e);
        updateStatus('offline');
        if (currentConsultationId === id) {
            if (!reconnectInterval) {
                reconnectInterval = setTimeout(() => {
                    reconnectInterval = null;
                    connectWebSocket(id);
                }, 3000);
            }
        }
    };

    chatSocket.onerror = function(err) {
        console.error("Lỗi WebSocket:", err);
        chatSocket.close(); 
    };
}

function updateStatus(state) {
    const el = document.getElementById('header-status');
    if (state === 'online') {
        el.innerHTML = '<i class="fas fa-circle x-small text-success"></i> Trực tuyến';
    } else if (state === 'connecting') {
        el.innerHTML = '<i class="fas fa-circle x-small text-warning"></i> Đang kết nối...';
    } else {
        el.innerHTML = '<i class="fas fa-circle x-small text-secondary"></i> Mất kết nối';
    }
}

// --- 3. XỬ LÝ HIỂN THỊ TIN NHẮN ---
async function fetchHistory(id) {
    const box = document.getElementById('message-box');
    box.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    
    try {
        const msgs = await fetchAPI(`/consultations/${id}/messages/`);
        
        if(msgs.length === 0) {
            box.innerHTML = '<div class="text-center text-muted mt-5"><p>Bắt đầu hỗ trợ khách hàng ngay.</p></div>';
            return;
        }
        
        box.innerHTML = ''; 
        msgs.forEach(m => {
            const formattedMsg = {
                message: m.message,
                is_staff_reply: m.is_staff_reply,
                created_at: new Date(m.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}),
                sender_name: m.sender_name,
                avatar: m.avatar,
                attachment_url: m.attachment_url, 
                attachment_type: m.attachment_type
            };
            appendMessage(formattedMsg);
        });
        
        scrollToBottom();

    } catch (e) { 
        box.innerHTML = '<div class="text-danger text-center">Không thể tải lịch sử chat.</div>';
    }
}

function appendMessage(data) {
    const box = document.getElementById('message-box');
    const isMe = data.is_staff_reply !== undefined ? data.is_staff_reply : data.is_staff;
    
    const alignClass = isMe ? 'msg-right' : 'msg-left';
    const justifyClass = isMe ? 'justify-content-end' : 'justify-content-start';
    
    const avatarLetter = data.sender_name ? data.sender_name.charAt(0).toUpperCase() : 'K';
    const avatarHtml = !isMe 
        ? `<div class="msgr-avatar bg-light text-dark me-2 flex-shrink-0 mt-1" style="width:28px;height:28px;font-size:0.8rem;font-weight:bold">${avatarLetter}</div>` 
        : '';
    
    const lastMessage = box.lastElementChild;
    const shouldShowName = !lastMessage || 
                           lastMessage.dataset.sender !== String(data.sender_name) || 
                           lastMessage.dataset.isstaff !== String(isMe);
                           
    const nameHtml = (shouldShowName && !isMe) 
        ? `<small class="text-muted text-truncate ms-2 mb-1" style="font-size:0.7rem; max-width:150px;">${data.sender_name || 'Khách hàng'}</small>` 
        : '';
    
    let contentHtml = '';
    
    if (data.message) {
        const safeText = data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        contentHtml += `<div class="msg-text">${safeText.replace(/\n/g, '<br>')}</div>`;
    }

    if (data.attachment_url) {
        const attachmentUrl = mediaUrl(data.attachment_url);
        const marginClass = data.message ? 'mt-2' : ''; 
        
        if (data.attachment_type === 'image') {
            contentHtml += `
                <div class="${marginClass}">
                    <a href="${attachmentUrl}" target="_blank" title="Bấm để xem ảnh lớn">
                        <img src="${attachmentUrl}" alt="Image" style="max-width: 220px; max-height: 250px; border-radius: 8px; object-fit: cover;">
                    </a>
                </div>`;
        } else {
            const linkColor = isMe ? 'text-white' : 'text-primary';
            contentHtml += `
                <div class="${marginClass} p-2 rounded d-flex align-items-center gap-2" style="background: rgba(0,0,0,0.05);">
                    <i class="fas fa-file-alt fs-4 ${linkColor}"></i>
                    <a href="${attachmentUrl}" target="_blank" class="${linkColor} text-decoration-none fw-bold" style="font-size: 0.85rem;">
                        Tệp đính kèm
                    </a>
                </div>`;
        }
    }
    
    if (!contentHtml) contentHtml = '<i class="text-muted">Tin nhắn không có nội dung</i>';

    let statusHtml = '';
    if (isMe) {
        if (data.is_read) {
            statusHtml = `<span class="text-success ms-1" style="font-size:0.75rem;" title="Khách đã xem">✓✓</span>`;
        } else {
            statusHtml = `<span class="text-white-50 ms-1" style="font-size:0.75rem;" title="Đã gửi">✓</span>`;
        }
    }

    const html = `
    <div class="d-flex w-100 ${justifyClass} mb-2 animate-fade-in" data-sender="${data.sender_name}" data-isstaff="${isMe}">
         ${avatarHtml}
         <div class="d-flex flex-column align-items-${isMe ? 'end' : 'start'}" style="max-width: 75%;">
            ${nameHtml}
            <div class="msg-bubble ${alignClass}" title="${data.sender_name || 'Hệ thống'} • ${data.created_at}">
                ${contentHtml}
                
                <div class="d-flex align-items-center justify-content-end mt-1 gap-1" style="opacity: 0.8;">
                    <small style="font-size:0.65rem;">${data.created_at}</small>
                    ${statusHtml}
                </div>
            </div>
         </div>
    </div>`;

    const emptyState = box.querySelector('.msgr-empty');
    if(emptyState) emptyState.remove();
    
    const loadingSpinner = box.querySelector('.spinner-border');
    if (loadingSpinner) box.innerHTML = '';

    box.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}

let typingTimeout = null;

function showTypingIndicator() {
    clearTimeout(typingTimeout);
    const box = document.getElementById('message-box');
    let indicator = box.querySelector('.typing-indicator-wrapper');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'typing-indicator-wrapper d-flex w-100 justify-content-start mb-2 animate-fade-in align-items-end';
        indicator.innerHTML = `
            <div class="msgr-avatar bg-light text-dark me-2 flex-shrink-0 mt-1" style="width:28px;height:28px;font-size:0.8rem;font-weight:bold">K</div>
            <div class="msg-bubble msg-left d-flex align-items-center gap-1" style="padding: 12px 16px; margin-bottom: 0; background: #e4e6eb; border-radius: 18px;">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
        `;
        box.appendChild(indicator);
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        const indicator = document.querySelector('.typing-indicator-wrapper');
        if (indicator) indicator.remove();
    }, 200);
}

function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return diffMins + 'p';
    if (diffHours < 24) return diffHours + 'h';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return diffDays + 'd';
    return date.toLocaleDateString('vi-VN');
}

function scrollToBottom() {
    const box = document.getElementById('message-box');
    box.scrollTop = box.scrollHeight;
}

// --- 4. GỬI TIN NHẮN ---
let typingSent = false;

// Bắt sự kiện gõ phím để gửi trạng thái "đang gõ..."
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('msg-input');
    if (input) {
        input.addEventListener('input', () => {
            if (!typingSent && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({ type: 'typing', sender_id: currentUser.id, is_staff: true }));
                typingSent = true;
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                if (typingSent && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                    chatSocket.send(JSON.stringify({ type: 'stop_typing', is_staff: true }));
                    typingSent = false;
                }
            }, 1500);
        });
    }
});

function sendMessage() {
    const input = document.getElementById('msg-input');
    const message = input.value.trim();
    
    if (!message) return;

    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        alert("Mất kết nối! Đang thử kết nối lại...");
        return;
    }

    chatSocket.send(JSON.stringify({
        'message': message,
        'sender_id': currentUser.id, 
        'is_staff': true 
    }));
    
    if (typingSent) {
        chatSocket.send(JSON.stringify({ type: 'stop_typing', is_staff: true }));
        typingSent = false;
    }

    input.value = '';
    input.focus();
}

// =========================================================
// TÍNH NĂNG UPLOAD FILE & ẢNH (DÀNH CHO ADMIN)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tạo thẻ input file ẩn nếu chưa có
    if (!document.getElementById('chat-file-upload')) {
        document.body.insertAdjacentHTML('beforeend', `
            <input type="file" id="chat-file-upload" style="display: none;" accept="image/*, .pdf, .doc, .docx, .xls, .xlsx">
        `);
    }

    const fileInput = document.getElementById('chat-file-upload');

    // 2. Gắn sự kiện click cho các icon Thêm file / Gửi ảnh của Admin
    const attachIcons = document.querySelectorAll('.msgr-footer-icons .fa-plus-circle, .msgr-footer-icons .fa-image');
    attachIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
                alert("Vui lòng kết nối vào phòng chat trước khi gửi file!");
                return;
            }
            fileInput.click();
        });
    });

    // 3. Xử lý khi Admin đã chọn file xong
    fileInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;

        // Reset value để có thể chọn lại file giống hệt sau đó
        this.value = '';

        if (file.size > 5 * 1024 * 1024) {
            alert("File quá lớn. Vui lòng chọn file dưới 5MB.");
            return;
        }

        // Bật trạng thái loading
        const msgInput = document.getElementById('msg-input');
        const oldPlaceholder = msgInput.placeholder || 'Aa';
        msgInput.placeholder = "Đang tải file...";
        msgInput.disabled = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Gọi API lưu file
            const response = await fetch(apiUrl('/chat/upload/'), {
                method: 'POST',
                headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Không thể tải file lên hệ thống.");
            }

            if (data.attachment_url) {
                // Phát sóng URL qua WebSocket (Dùng currentUser và is_staff: true cho Admin)
                chatSocket.send(JSON.stringify({
                    'message': '', 
                    'sender_id': currentUser.id, 
                    'is_staff': true,
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
            // Tắt trạng thái loading
            msgInput.placeholder = oldPlaceholder;
            msgInput.disabled = false;
            msgInput.focus();
        }
    });
});

function handleEnter(e) {
    if(e.key === 'Enter') sendMessage();
}

// CSS Animation nhúng
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
        animation: typing-dots 1.4s infinite;
    }
    .typing-indicator-wrapper .dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator-wrapper .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-dots {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);


// 1. Thêm sự kiện click cho nút lưu trữ trong DOMContentLoaded hoặc openChat
function setupArchiveListener() {
    const archiveBtn = document.getElementById('btn-archive-chat');
    if (archiveBtn) {
        archiveBtn.onclick = async () => {
            if (!currentConsultationId) return;

            const confirmArchive = confirm("Bạn có chắc chắn muốn lưu trữ cuộc hội thoại này không? Tin nhắn sẽ được chuyển vào mục Lưu trữ.");
            if (confirmArchive) {
                try {
                    // Gọi API cập nhật status thành 'archived'
                    await fetchAPI(`/consultations/${currentConsultationId}/`, 'PATCH', { status: 'archived' });

                    alert("Đã lưu trữ thành công!");
                    // Load lại danh sách và đóng khung chat hiện tại
                    loadConversations();
                    document.getElementById('input-area').style.display = 'none';
                    document.getElementById('header-actions').style.display = 'none';
                    document.getElementById('message-box').innerHTML = `
                        <div class="msgr-empty">
                            <p class="text-muted">Cuộc hội thoại đã được chuyển vào mục lưu trữ.</p>
                        </div>`;
                } catch (e) {
                    alert("Lỗi khi lưu trữ cuộc trò chuyện.");
                }
            }
        };
    }
}

// 3. Hàm lọc theo trạng thái (chỉnh sửa lại logic filter cũ)
function filterConversationsByStatus(filterType) {
    const items = document.querySelectorAll('.msgr-item');
    items.forEach(item => {
        const status = item.getAttribute('data-status');
        
        if (filterType === 'all') {
            // "Tất cả" thường sẽ không hiện đồ đã lưu trữ trừ khi bạn muốn hiện hết
            item.style.display = (status !== 'archived') ? 'flex' : 'none';
        } else if (filterType === 'archived') {
            item.style.display = (status === 'archived') ? 'flex' : 'none';
        } else {
            // Xử lý guest/user và ẩn archived
            const type = item.getAttribute('data-user-type');
            item.style.display = (type === filterType && status !== 'archived') ? 'flex' : 'none';
        }
    });
}
