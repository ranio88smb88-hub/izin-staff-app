// ==================== MAIN APP LOGIC ====================

document.addEventListener('DOMContentLoaded', function() {
    // Cek apakah user sudah login
    checkAuth();
    
    // Setup event listeners
    setupEventListeners();
});

function checkAuth() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // User sudah login
            console.log('User logged in:', user.email);
            updateUIForLoggedInUser();
        } else {
            // User belum login
            console.log('No user logged in');
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
        }
    });
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Izin button
    const izinBtn = document.getElementById('izinBtn');
    if (izinBtn) {
        izinBtn.addEventListener('click', handleIzin);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMsg');
    
    // Reset error
    if (errorMsg) errorMsg.textContent = '';
    
    // Validasi
    if (!email || !password) {
        showError('Email dan password harus diisi');
        return;
    }
    
    // Disable button
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    
    try {
        await window.authLogic.loginWithShiftValidation(email, password);
        // Redirect akan dilakukan otomatis
    } catch (error) {
        showError(error.message);
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Login';
    }
}

async function handleIzin() {
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
        alert('Silakan login terlebih dahulu');
        return;
    }
    
    try {
        const result = await window.izinLogic.requestIzin(userId, 'keluar');
        alert(result.message);
        
        // Update UI
        updateIzinCount();
    } catch (error) {
        alert(error.message);
    }
}

async function handleLogout() {
    if (confirm('Yakin ingin logout?')) {
        await window.authLogic.logout();
    }
}

function updateUIForLoggedInUser() {
    const user = window.authLogic.getCurrentUser();
    
    // Update nama user
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
        el.textContent = user.name;
    });
    
    // Update shift
    const shiftElements = document.querySelectorAll('.user-shift');
    shiftElements.forEach(el => {
        el.textContent = user.shift;
    });
    
    // Update izin count
    updateIzinCount();
}

async function updateIzinCount() {
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;
    
    const izinCount = await window.izinLogic.checkDailyLimit(userId);
    const maxIzin = window.izinLogic.maxIzinPerHari;
    
    const izinCounter = document.getElementById('izinCounter');
    if (izinCounter) {
        izinCounter.textContent = `${izinCount} / ${maxIzin}`;
    }
    
    const izinBtn = document.getElementById('izinBtn');
    if (izinBtn) {
        if (izinCount >= maxIzin) {
            izinBtn.disabled = true;
            izinBtn.innerHTML = '<i class="fas fa-ban"></i> Batas Izin';
        } else {
            izinBtn.disabled = false;
            izinBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Izin Keluar';
        }
    }
}

function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    } else {
        alert(message);
    }
}

// Global function untuk digunakan di HTML
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleIzin = handleIzin;
