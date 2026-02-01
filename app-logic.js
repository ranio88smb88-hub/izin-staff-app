// ==================== ALL LOGIC IN ONE FILE ====================

// 1. AUTH LOGIC
class AuthLogic {
    async loginWithShiftValidation(email, password) {
        // ... (sama seperti kode sebelumnya)
    }
}

// 2. IZIN LOGIC
class IzinLogic {
    async requestIzin(staffId, type) {
        // ... (sama seperti kode sebelumnya)
    }
}

// 3. Initialize
let authLogic, izinLogic;

// Init ketika halaman load
document.addEventListener('DOMContentLoaded', function() {
    authLogic = new AuthLogic();
    izinLogic = new IzinLogic();
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Izin button
    const btnIzin = document.getElementById('btnIzin');
    if (btnIzin) {
        btnIzin.addEventListener('click', handleIzin);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        await authLogic.loginWithShiftValidation(email, password);
        alert('Login berhasil!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function handleIzin() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('Silakan login terlebih dahulu');
        return;
    }
    
    try {
        const result = await izinLogic.requestIzin(userId, 'keluar');
        alert('Izin dibuat: ' + result.message);
    } catch (error) {
        alert('Gagal izin: ' + error.message);
    }
}
