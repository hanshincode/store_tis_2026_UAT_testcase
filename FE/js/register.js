// js/register.js
document.addEventListener('DOMContentLoaded', () => {
    if (getAccessToken()) redirectTo('user/index.html');

    const userTypeSelect = document.getElementById('user_type');
    const entFields = document.getElementById('enterprise-fields');
    const companyNameInput = document.getElementById('company_name');
    const taxCodeInput = document.getElementById('tax_code');

    userTypeSelect.addEventListener('change', function(e) {
        if (e.target.value === 'enterprise') {
            entFields.classList.remove('d-none');
            companyNameInput.required = true; taxCodeInput.required = true;
        } else {
            entFields.classList.add('d-none');
            companyNameInput.required = false; taxCodeInput.required = false;
        }
    });

    document.getElementById('btn-lookup-mst')?.addEventListener('click', lookupMST);
    taxCodeInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupMST(); }});
    document.getElementById('password')?.addEventListener('input', checkPasswordStrength);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
});

async function lookupMST() {
    const mst = document.getElementById('tax_code').value.trim();
    if (!mst) return Toast.fire({ icon: 'warning', title: 'Vui lòng nhập Mã số thuế!' });

    const btn = document.getElementById('btn-lookup-mst');
    const companyNameInput = document.getElementById('company_name');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        const res = await fetch(`https://api.vietqr.io/v2/business/${mst}`);
        const data = await res.json();
        if (data.code === '00' && data.data) {
            companyNameInput.value = data.data.name; companyNameInput.readOnly = true;
            Toast.fire({ icon: 'success', title: 'Lấy thông tin thành công!' });
        } else throw new Error('Không tìm thấy MST');
    } catch (e) {
        Toast.fire({ icon: 'error', title: 'Không tìm thấy MST! Vui lòng nhập tay.' });
        companyNameInput.value = ''; companyNameInput.readOnly = false; companyNameInput.focus();
    } finally { btn.innerHTML = 'Tra cứu'; btn.disabled = false; }
}

function checkPasswordStrength(e) {
    const password = e.target.value;
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const container = document.getElementById('password-strength-container');

    if (password.length === 0) { container.style.display = 'none'; strengthText.style.display = 'none'; return; }
    container.style.display = 'flex'; strengthText.style.display = 'block';

    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 8) strength += 1;
    if (password.match(/[a-z]+/)) strength += 1;
    if (password.match(/[A-Z]+/)) strength += 1;
    if (password.match(/[0-9]+/)) strength += 1;
    if (password.match(/[$@#&!%^*?_~]+/)) strength += 1;

    strengthBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    if (password.length < 6) { strengthBar.style.width = '20%'; strengthBar.classList.add('bg-danger'); strengthText.textContent = 'Yếu: Cần ít nhất 6 ký tự'; strengthText.className = 'text-danger mt-1 d-block small'; } 
    else if (strength <= 3) { strengthBar.style.width = '50%'; strengthBar.classList.add('bg-warning'); strengthText.textContent = 'Trung bình: Thêm số hoặc chữ hoa'; strengthText.className = 'text-warning mt-1 d-block small'; } 
    else if (strength <= 5) { strengthBar.style.width = '75%'; strengthBar.classList.add('bg-info'); strengthText.textContent = 'Khá: Thêm ký tự đặc biệt'; strengthText.className = 'text-info mt-1 d-block small'; } 
    else { strengthBar.style.width = '100%'; strengthBar.classList.add('bg-success'); strengthText.textContent = 'Tuyệt vời!'; strengthText.className = 'text-success mt-1 d-block small'; }
}

async function handleRegister(e) {
    e.preventDefault();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    if (password !== document.getElementById('confirm_password').value) return Toast.fire({ icon: 'warning', title: "Mật khẩu không khớp!" });
    if (password.length < 6) return Toast.fire({ icon: 'warning', title: "Mật khẩu phải từ 6 ký tự!" });

    const btn = document.getElementById('btn-register'); const originalText = btn.innerText;
    btn.innerText = 'Đang xử lý...'; btn.disabled = true;

    try {
        await fetchAPI('/register/', 'POST', {
            username: phone, phone: phone, password: password, role: 'customer', user_type: document.getElementById('user_type').value,
            first_name: document.getElementById('first_name').value.trim(), email: "", 
            company_name: document.getElementById('company_name')?.value.trim() || "", tax_code: document.getElementById('tax_code')?.value.trim() || ""
        });
        Swal.fire({ icon: 'success', title: 'Thành công!', text: 'Vui lòng đăng nhập.', confirmButtonColor: '#D71920' }).then(() => { redirectTo('login.html'); });
    } catch (error) {
        Toast.fire({ icon: 'error', title: (error.username || error.phone) ? "Số điện thoại đã tồn tại!" : "Lỗi hệ thống!" });
    } finally { btn.innerText = originalText; btn.disabled = false; }
}
