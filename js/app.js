// ==================== MAIN APP LOGIC ====================
// INITIALIZATION & EVENT HANDLERS

class AppLogic {
    constructor() {
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.currentUser = null;
        this.realtime = window.realtimeLogic || null;
    }

    // ==================== INITIALIZATION ====================

    async init() {
        console.log("🚀 Initializing application...");
        
        try {
            // Setup Firebase Auth State Listener
            this.setupAuthListener();
            
            // Setup global error handler
            this.setupErrorHandling();
            
            // Load initial data based on current page
            this.loadPageSpecificData();
            
            console.log("✅ Application initialized successfully");
            
        } catch (error) {
            console.error("❌ Application initialization failed:", error);
            this.showError("Gagal memuat aplikasi: " + error.message);
        }
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("👤 User authenticated:", user.email || user.uid);
                this.currentUser = user;
                
                // Load user data from Firestore
                await this.loadUserData(user.uid);
                
                // Update UI for logged in user
                this.updateUIForLoggedInUser();
                
                // Setup real-time updates if available
                if (this.realtime) {
                    this.setupRealtimeUpdates();
                }
                
            } else {
                console.log("👤 No user authenticated");
                this.currentUser = null;
                
                // Redirect to login if not on login page
                if (!window.location.pathname.includes('index.html')) {
                    console.log("➡️ Redirecting to login page");
                    window.location.href = 'index.html?message=Silakan+login+terlebih+dahulu';
                }
            }
        });
    }

    async loadUserData(userId) {
        try {
            const userDoc = await this.db.collection('staff').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Store in sessionStorage
                sessionStorage.setItem('userData', JSON.stringify(userData));
                sessionStorage.setItem('userId', userId);
                sessionStorage.setItem('userName', userData.nama || '');
                sessionStorage.setItem('userRole', userData.role || 'staff');
                sessionStorage.setItem('userJobdesk', userData.jobdesk || '');
                sessionStorage.setItem('userShift', `${userData.shiftMulai || ''} - ${userData.shiftSelesai || ''}`);
                
                console.log("📋 User data loaded:", userData.nama);
                return userData;
            }
        } catch (error) {
            console.error("❌ Error loading user data:", error);
        }
        return null;
    }

    // ==================== PAGE SPECIFIC LOADING ====================

    loadPageSpecificData() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        console.log("📄 Current page:", currentPage);
        
        switch(currentPage) {
            case 'index.html':
                this.setupLoginPage();
                break;
                
            case 'dashboard.html':
                this.setupDashboardPage();
                break;
                
            case 'admin.html':
                this.setupAdminPage();
                break;
                
            default:
                console.log("⚠️ Unknown page, using default setup");
        }
    }

    setupLoginPage() {
        console.log("🔐 Setting up login page...");
        
        // Setup login form if exists
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }
        
        // Check for URL parameters (messages)
        this.checkUrlParameters();
    }

    setupDashboardPage() {
        console.log("📊 Setting up dashboard page...");
        
        // Protect route - must be logged in
        if (!this.currentUser) {
            window.location.href = 'index.html?message=Silakan+login+terlebih+dahulu';
            return;
        }
        
        // Load dashboard data
        this.loadDashboardData();
        
        // Setup event listeners
        this.setupDashboardEvents();
        
        // Update user info in UI
        this.updateUserInfo();
    }

    setupAdminPage() {
        console.log("👑 Setting up admin page...");
        
        // Protect route - must be admin
        if (!this.currentUser) {
            window.location.href = 'index.html';
            return;
        }
        
        // Check if user is admin
        const userRole = sessionStorage.getItem('userRole');
        if (userRole !== 'admin') {
            window.location.href = 'dashboard.html?message=Akses+ditolak';
            return;
        }
        
        // Load admin data
        this.loadAdminData();
        
        // Setup admin event listeners
        this.setupAdminEvents();
    }

    // ==================== EVENT HANDLERS ====================

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value;
        const loginBtn = document.getElementById('loginBtn');
        const errorMsg = document.getElementById('errorMsg');
        
        if (!email || !password) {
            this.showError('Email dan password harus diisi', errorMsg);
            return;
        }
        
        // Show loading state
        if (loginBtn) {
            const originalText = loginBtn.innerHTML;
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            
            try {
                // Use authLogic for shift validation
                if (window.authLogic) {
                    await window.authLogic.loginWithShiftValidation(email, password);
                    // Redirect happens automatically in authLogic
                } else {
                    // Fallback to direct Firebase auth
                    await this.auth.signInWithEmailAndPassword(email, password);
                }
            } catch (error) {
                this.showError(this.getErrorMessage(error), errorMsg);
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
            }
        }
    }

    handleLogout() {
        if (confirm('Apakah Anda yakin ingin logout?')) {
            if (window.authLogic) {
                window.authLogic.logout();
            } else {
                this.auth.signOut();
                sessionStorage.clear();
                window.location.href = 'index.html';
            }
        }
    }

    // ==================== DATA LOADING ====================

    async loadDashboardData() {
        console.log("📥 Loading dashboard data...");
        
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;
        
        try {
            // Load user's active izin
            if (window.izinLogic) {
                const activeIzin = await window.izinLogic.getActiveIzin(userId);
                this.updateActiveIzinUI(activeIzin);
                
                // Load izin history
                const history = await window.izinLogic.getIzinHistory(userId, 10);
                this.updateIzinHistoryUI(history);
                
                // Load daily limit
                const limit = await window.izinLogic.checkDailyLimit(userId);
                this.updateDailyLimitUI(limit);
            }
            
            // Load all active izin for monitoring
            this.loadActiveIzinAll();
            
        } catch (error) {
            console.error("❌ Error loading dashboard data:", error);
        }
    }

    async loadAdminData() {
        console.log("📥 Loading admin data...");
        
        try {
            // Load all staff
            if (window.adminLogic) {
                const staff = await window.adminLogic.getAllStaff();
                this.updateStaffListUI(staff);
                
                // Load stats
                const stats = await window.adminLogic.getDashboardStats();
                this.updateAdminStatsUI(stats);
                
                // Load settings
                const settings = await window.adminLogic.getSettings();
                this.updateSettingsUI(settings);
            }
            
        } catch (error) {
            console.error("❌ Error loading admin data:", error);
        }
    }

    // ==================== UI UPDATES ====================

    updateUIForLoggedInUser() {
        const userName = sessionStorage.getItem('userName');
        const userRole = sessionStorage.getItem('userRole');
        
        console.log("🎨 Updating UI for user:", userName, "Role:", userRole);
        
        // Update user name in all elements
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = userName || 'User';
        });
        
        // Update user role badge
        document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = userRole === 'admin' ? 'Admin' : 'Staff';
            el.className = userRole === 'admin' ? 'badge badge-danger' : 'badge badge-primary';
        });
        
        // Show/hide admin elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = userRole === 'admin' ? '' : 'none';
        });
        
        // Update shift info
        const shift = sessionStorage.getItem('userShift');
        if (shift) {
            document.querySelectorAll('.user-shift').forEach(el => {
                el.textContent = shift;
            });
        }
    }

    updateActiveIzinUI(izin) {
        const container = document.getElementById('activeIzinContainer');
        if (!container) return;
        
        if (!izin) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> Tidak ada izin aktif
                </div>
            `;
            return;
        }
        
        const remaining = izin.remaining || 0;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-walking"></i> Izin Aktif</h5>
                </div>
                <div class="card-body">
                    <p><strong>Jenis:</strong> ${izin.type === 'keluar' ? 'Keluar' : 'Makan'}</p>
                    <p><strong>Mulai:</strong> ${window.izinLogic?.formatTime(izin.waktuMulai)}</p>
                    <p><strong>Sisa Waktu:</strong> 
                        <span class="badge ${remaining < 60 ? 'badge-danger' : 'badge-warning'}">
                            ${minutes}:${seconds.toString().padStart(2, '0')}
                        </span>
                    </p>
                    <button class="btn btn-primary btn-block" onclick="app.returnFromIzin('${izin.id}')">
                        <i class="fas fa-sign-in-alt"></i> Kembali
                    </button>
                </div>
            </div>
        `;
    }

    updateDailyLimitUI(limit) {
        const remainingEl = document.getElementById('remainingIzin');
        const progressEl = document.getElementById('izinProgress');
        
        if (remainingEl) {
            remainingEl.textContent = `${limit.remaining}/${limit.max}`;
        }
        
        if (progressEl) {
            const percent = (limit.count / limit.max) * 100;
            progressEl.style.width = `${percent}%`;
            progressEl.className = `progress-bar ${percent >= 100 ? 'bg-danger' : percent >= 75 ? 'bg-warning' : 'bg-success'}`;
        }
    }

    // ==================== REALTIME UPDATES ====================

    setupRealtimeUpdates() {
        if (!this.realtime) return;
        
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;
        
        console.log("🔄 Setting up real-time updates...");
        
        // Monitor active izin
        this.realtime.monitorActiveIzin((activeIzin) => {
            this.updateActiveIzinList(activeIzin);
        });
        
        // Monitor user's own izin
        this.realtime.monitorUserIzin(userId, (izin) => {
            this.updateActiveIzinUI(izin);
        });
        
        // Start real-time clock
        this.realtime.startRealtimeClock((time, date) => {
            this.updateClock(time, date);
        });
    }

    updateActiveIzinList(activeIzin) {
        const container = document.getElementById('activeIzinList');
        if (!container) return;
        
        if (activeIzin.length === 0) {
            container.innerHTML = '<p class="text-muted">Tidak ada staff yang sedang izin</p>';
            return;
        }
        
        let html = '';
        activeIzin.forEach(izin => {
            const minutes = Math.floor(izin.remaining / 60);
            const seconds = izin.remaining % 60;
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${izin.nama}</h6>
                            <small class="text-muted">${izin.jobdesk} • ${izin.type === 'keluar' ? 'Keluar' : 'Makan'}</small>
                        </div>
                        <div class="text-right">
                            <span class="badge ${izin.isLate ? 'badge-danger' : 'badge-warning'}">
                                ${minutes}:${seconds.toString().padStart(2, '0')}
                            </span>
                            <br>
                            <small>${window.izinLogic?.formatTime(izin.waktuMulai)}</small>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // ==================== HELPER FUNCTIONS ====================

    showError(message, element = null) {
        console.error("❌ Error:", message);
        
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        console.log("✅ Success:", message);
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'alert alert-success alert-dismissible fade show';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i> ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    getErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'Email tidak terdaftar',
            'auth/wrong-password': 'Password salah',
            'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti',
            'auth/network-request-failed': 'Koneksi internet bermasalah',
            'auth/invalid-email': 'Format email tidak valid'
        };
        
        return errorMessages[error.code] || error.message || 'Terjadi kesalahan';
    }

    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        const error = urlParams.get('error');
        
        if (message) {
            this.showSuccess(decodeURIComponent(message));
        }
        
        if (error) {
            this.showError(decodeURIComponent(error));
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    // ==================== PUBLIC METHODS ====================

    async returnFromIzin(izinId) {
        if (!confirm('Konfirmasi kembali dari izin?')) return;
        
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;
        
        try {
            if (window.izinLogic) {
                await window.izinLogic.endIzin(userId, izinId);
                this.showSuccess('Berhasil kembali dari izin');
            }
        } catch (error) {
            this.showError('Gagal: ' + error.message);
        }
    }

    requestIzin(type = 'keluar') {
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            this.showError('Silakan login terlebih dahulu');
            return;
        }
        
        if (!confirm(`Ajukan izin ${type}?`)) return;
        
        if (window.izinLogic) {
            window.izinLogic.requestIzin(userId, type)
                .then(result => {
                    this.showSuccess(result.message);
                })
                .catch(error => {
                    this.showError(error.message);
                });
        }
    }

    // ==================== GETTERS ====================

    getUser() {
        return {
            id: sessionStorage.getItem('userId'),
            name: sessionStorage.getItem('userName'),
            role: sessionStorage.getItem('userRole'),
            jobdesk: sessionStorage.getItem('userJobdesk'),
            shift: sessionStorage.getItem('userShift'),
            data: JSON.parse(sessionStorage.getItem('userData') || '{}')
        };
    }

    isAdmin() {
        return sessionStorage.getItem('userRole') === 'admin';
    }

    isLoggedIn() {
        return !!sessionStorage.getItem('userId') && !!this.auth.currentUser;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new AppLogic();
    window.app.init();
    
    // Expose methods to global scope
    window.handleLogin = (e) => window.app.handleLogin(e);
    window.handleLogout = () => window.app.handleLogout();
    window.requestIzin = (type) => window.app.requestIzin(type);
    window.returnFromIzin = (izinId) => window.app.returnFromIzin(izinId);
});
