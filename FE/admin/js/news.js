// admin/js/news.js

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-add-news')?.addEventListener('click', () => { 
        document.getElementById('news-form').reset(); 
        new bootstrap.Modal(document.getElementById('newsModal')).show(); 
    });
    document.getElementById('btn-submit-news')?.addEventListener('click', submitNews);
    
    // Tải danh sách khi mở trang
    loadNews();
});

async function loadNews() {
    const list = document.getElementById('news-list'); 
    list.innerHTML = '<div class="text-center w-100 mt-5"><div class="spinner-border text-danger"></div></div>';
    
    try {
        // Gọi API qua file common.js
        const response = await fetchAPI('/news/');
        
        // Đề phòng trường hợp Django trả về cục data có phân trang (pagination)
        const newsList = response.results ? response.results : response;
        
        if (newsList.length === 0) {
            list.innerHTML = '<p class="text-muted w-100 text-center mt-5">Chưa có bài viết nào.</p>';
            return;
        }

        // ĐÃ SỬA LỖI: Xóa biến MEDIA_URL gây crash, lấy trực tiếp n.image
        list.innerHTML = newsList.map(n => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-0">
                    <img src="${n.image ? n.image : '../images/placeholder.jpg'}" class="card-img-top" style="height:200px;object-fit:cover">
                    <div class="card-body d-flex flex-column">
                        <h6 class="fw-bold">${n.title}</h6>
                        <small class="text-muted d-block mb-3"><i class="far fa-clock"></i> ${new Date(n.created_at).toLocaleDateString('vi-VN')}</small>
                        <button class="btn btn-sm btn-outline-danger mt-auto" onclick="window.deleteNews(${n.id})">
                            <i class="fas fa-trash"></i> Xóa bài
                        </button>
                    </div>
                </div>
            </div>`).join('');
            
    } catch(e) { 
        console.error("Chi tiết lỗi JS:", e); // In ra console F12 để dễ kiểm tra
        list.innerHTML = '<p class="text-danger w-100 text-center mt-5">Lỗi tải dữ liệu. Hãy nhấn F12 để xem chi tiết.</p>'; 
    }
}

async function submitNews() {
    const fd = new FormData(); 
    fd.append('title', document.getElementById('n-title').value); 
    fd.append('content', document.getElementById('n-content').value);
    
    const imageFile = document.getElementById('n-image').files[0];
    if(imageFile) {
        fd.append('image', imageFile);
    }

    try {
        // Gửi POST tới endpoint /api/news/
        const res = await fetch(`${API_BASE_URL}/news/`, { 
            method: 'POST', 
            headers: {'Authorization': `Bearer ${getAccessToken()}`}, 
            body: fd 
        });

        if (!res.ok) throw new Error("API từ chối");

        bootstrap.Modal.getInstance(document.getElementById('newsModal')).hide(); 
        loadNews(); 
        Toast.fire({icon:'success', title:'Đăng bài thành công'});
        
    } catch (e) {
        Toast.fire({icon:'error', title:'Đăng bài thất bại'});
        console.error(e);
    }
}

window.deleteNews = async function(id) { 
    if(!confirm('Bạn có chắc chắn muốn xóa bài viết này vĩnh viễn?')) return; 
    
    try {
        await fetchAPI(`/news/${id}/`, 'DELETE'); 
        loadNews(); 
        Toast.fire({icon:'success', title:'Đã xóa bài viết'});
    } catch (e) {
        Toast.fire({icon:'error', title:'Xóa bài thất bại'});
        console.error(e);
    }
};