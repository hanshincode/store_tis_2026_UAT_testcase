// js/auth-banner.js

document.addEventListener('DOMContentLoaded', () => {
    
    // ================= CẤU HÌNH =================
    const ALBUM_PATH = 'images/album/'; // Thư mục chứa ảnh gốc
    const SWITCH_TIME = 7000; // Thời gian chuyển mỗi ảnh (7000ms = 7 giây)

    // Danh sách toàn bộ ảnh đã được trích xuất từ thư mục của bạn
    const IMAGE_LIST = [
        'shutterstock_673842874.jpg',
        'shutterstock_660832780.jpg',
        'shutterstock_2577344341.jpg',
        'shutterstock_563270320.jpg',
        'shutterstock_409344172.jpg',
        'shutterstock_561677989.jpg',
        'shutterstock_2528928597.jpg',
        'shutterstock_2548605069.jpg',
        'shutterstock_2222352899.jpg',
        'shutterstock_2308801975.jpg',
        'hospital.jpg',
        'shutterstock_317578871.jpg',
        'shutterstock_1878018001.jpg',
        'shutterstock_2561976731.jpg',
        'shutterstock_1871428867.jpg',
        'shutterstock_2437888025.jpg',
        'shutterstock_2364843827.jpg',
        'shutterstock_2431406087.jpg',
        'shutterstock_2445632105.jpg',
        'shutterstock_2631423457.jpg'
    ];
    // ============================================

    // 1. Tìm container chứa Slideshow
    const container = document.getElementById('banner-slideshow');
    
    // Nếu không tìm thấy container (ví dụ mở trang khác) hoặc không có ảnh thì dừng script
    if (!container || IMAGE_LIST.length === 0) return;

    let slides = [];
    let currentIdx = -1;

    // 2. Khởi tạo các thẻ div chứa ảnh (chỉ chạy 1 lần lúc load trang)
    function initSlides() {
        IMAGE_LIST.forEach((filename) => {
            const slide = document.createElement('div');
            slide.className = 'banner-slide';
            // Dùng CSS background-image để ảnh luôn phủ kín (cover) và không bị méo tỉ lệ
            slide.style.backgroundImage = `url('${ALBUM_PATH}${filename}')`;
            container.appendChild(slide);
            slides.push(slide);
        });
    }

    // 3. Hàm chuyển đổi qua lại giữa các slide ngẫu nhiên
    function showNextRandomSlide() {
        let nextIdx;
        
        do {
            nextIdx = Math.floor(Math.random() * slides.length);
        } while (slides.length > 1 && nextIdx === currentIdx);

        // XỬ LÝ ẢNH CŨ (Đang mờ dần)
        if (currentIdx >= 0) {
            const oldSlide = slides[currentIdx];
            oldSlide.classList.remove('active'); // Bắt đầu mờ đi từ từ (tốn 2.5s)
            
            // TRICK CHỐNG GIẬT: Đợi đúng 2.5 giây cho ảnh cũ mờ hẳn (tàng hình)
            // rồi mới gỡ hiệu ứng zoom của nó ra để tái sử dụng.
            setTimeout(() => {
                oldSlide.classList.remove('zooming');
            }, 2500); 
        }

    // Tạo slide mới ngay tại thời điểm cần dùng (Lazy Load)
        const newSlide = document.createElement('div');
        newSlide.className = 'banner-slide zooming';
        newSlide.style.backgroundImage = `url('${ALBUM_PATH}${IMAGE_LIST[nextIdx]}')`;
        container.appendChild(newSlide);

        setTimeout(() => {
            newSlide.classList.add('active');
            
            // Xóa slide cũ sau khi tấm mới đã hiện đè lên hoàn toàn
            if (container.children.length > 2) {
                container.removeChild(container.children[0]);
            }
        }, 50);
    }

    // --- KHỞI CHẠY HỆ THỐNG ---
    initSlides(); // Nạp sẵn bộ khung HTML của tất cả các ảnh
    
    // Đợi 200ms để CSS kịp tải xong rồi mới hiện tấm ảnh đầu tiên (tránh bị giật chớp đen)
    setTimeout(() => {
        showNextRandomSlide(); 
        
        // Đặt lịch lặp lại vòng tuần hoàn chuyển ảnh
        setInterval(showNextRandomSlide, SWITCH_TIME); 
    }, 200);

});