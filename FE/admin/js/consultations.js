// fontend/admin/js/consultations.js

document.addEventListener('DOMContentLoaded', () => {
    // Kiểm tra token admin trước khi load
    if (!getAccessToken()) {
        window.location.href = 'login.html';
        return;
    }
    loadConsultations();
});

// fontend/admin/js/consultations.js

async function loadConsultations() {
    const tbody = document.getElementById('consultation-list');
    // ... (Loading code) ...
    try {
        const data = await fetchAPI('/consultations/');
        tbody.innerHTML = data.map(item => {
            // Xử lý hiển thị Processor
            let processorHtml = '<span class="text-muted small fst-italic">Chưa có</span>';
            let btnHtml = `<button class="btn btn-sm btn-primary" onclick="acceptAndChat(${item.id})"><i class="fas fa-hand-paper me-1"></i> Tiếp nhận</button>`;

            if (item.processor_name) {
                // Đã có người nhận
                processorHtml = `<div class="d-flex align-items-center gap-2">
                    <div class="bg-light rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold" style="width: 30px; height: 30px;">
                        ${item.processor_name.charAt(0)}
                    </div>
                    <span class="fw-bold text-dark">${item.processor_name}</span>
                </div>`;
                
                // Nút chuyển thành "Chat Ngay"
                btnHtml = `<button class="btn btn-sm btn-success" onclick="goToChat(${item.id})"><i class="fab fa-facebook-messenger me-1"></i> Chat Ngay</button>`;
            }

            return `
            <tr>
                <td>
                    <div class="fw-bold">${item.customer_name}</div>
                    <small class="text-muted">#${item.id}</small>
                </td>
                <td>${item.customer_contact}</td>
                <td>${item.product_name || 'Chung'}</td>
                <td>${processorHtml}</td> <td><span class="badge bg-${item.status === 'new' ? 'warning' : 'success'}">${item.status === 'new' ? 'Mới' : 'Đang xử lý'}</span></td>
                <td>${btnHtml}</td>
            </tr>
        `}).join('');
    } catch (e) { console.error(e); }
}

// Hàm tiếp nhận và chuyển trang
async function acceptAndChat(id) {
    try {
        await fetchAPI(`/consultations/${id}/assign_processor/`, 'POST');
        Toast.fire({ icon: 'success', title: 'Đã tiếp nhận yêu cầu!' });
        setTimeout(() => { window.location.href = `chat.html?id=${id}`; }, 500);
    } catch (e) { 
        Toast.fire({ icon: 'error', title: 'Lỗi tiếp nhận: ' + e.message }); 
    }
}

function goToChat(id) {
    window.location.href = `chat.html?id=${id}`;
}



// Thay thế hàm handleTicket cũ bằng hàm này:
async function handleTicket(id) {
    try {
        // 1. Gọi API để nhận ticket này về mình
        await fetchAPI(`/consultations/${id}/assign_processor/`, 'POST');
        
        // 2. Chuyển hướng sang trang Chat
        window.location.href = `chat.html?id=${id}`;
    } catch (e) {
        alert("Lỗi tiếp nhận: " + e.message);
    }
}