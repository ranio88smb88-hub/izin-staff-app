// ==================== AUTH LOGIC ====================
// LOGIN DENGAN VALIDASI SHIFT

class AuthLogic {
    constructor() {
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.sessionTimer = null;
        this.shiftCheckTimer = null;
    }

    async loginWithShiftValidation(email, password) {
        try {
            // 1. Login dengan Firebase Auth
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // 2. Ambil data staff
            const staffDoc = await this.db.collection('staff').doc(user.uid).get();
            
            if (!staffDoc.exists) {
                await this.auth.signOut();
                throw new Error('Data staff tidak ditemukan. Hubungi admin.');
            }
            
            const staffData = staffDoc.data();
            
            // 3. VALIDASI: Login hanya di jam shift
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            
            // Parse waktu shift
            const [startHour, startMin] = staffData.shiftMulai.split(':').map(Number);
            const [endHour, endMin] = staffData.shiftSelesai.split(':').map(Number);
            
            const shiftStart = startHour * 60 + startMin;
            const shiftEnd = endHour * 60 + endMin;
            
            // Cek apakah dalam jam shift
            let isWithinShift;
            if (shiftEnd < shiftStart) {
                // Shift melewati tengah malam (contoh: 14:45 - 00:45)
                isWithinShift = currentTime >= shiftStart || currentTime <= shiftEnd;
            } else {
                // Shift normal
                isWithinShift = currentTime >= shiftStart && currentTime <= shiftEnd;
            }
            
            if (!isWithinShift) {
                await this.auth.signOut();
                throw new Error(`❌ DILARANG LOGIN! \nShift Anda: ${staffData.shiftMulai} - ${staffData.shiftSelesai} \nSekarang: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
            }
            
            // 4. Update status login & reset izin harian
            await this.db.collection('staff').doc(user.uid).update({
                statusLogin: true,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                izinHariIni: 0 // Reset saat login
            });
            
            // 5. Simpan ke sessionStorage
            sessionStorage.setItem('userRole', staffData.role || 'staff');
            sessionStorage.setItem('userId', user.uid);
            sessionStorage.setItem('userName', staffData.nama);
            sessionStorage.setItem('jobdesk', staffData.jobdesk);
            sessionStorage.setItem('shift', staffData.shiftMulai + ' - ' + staffData.shiftSelesai);
            
            // 6. Start session timer (8 jam)
            this.startSessionTimer();
            
            // 7. Redirect
            setTimeout(() => {
                if (staffData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1000);
            
            return { success: true, user: staffData };
            
        } catch (error) {
            console.error('Login error:', error);
            await this.auth.signOut();
            throw error;
        }
    }

    startSessionTimer(timeoutHours = 8) {
        // Hapus timer sebelumnya
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        if (this.shiftCheckTimer) clearInterval(this.shiftCheckTimer);
        
        // Session timeout: 8 jam
        const timeoutMs = timeoutHours * 60 * 60 * 1000;
        this.sessionTimer = setTimeout(() => {
            this.autoLogout('Session timeout (8 jam)');
        }, timeoutMs);
        
        // Cek shift setiap 1 menit
        this.shiftCheckTimer = setInterval(() => {
            this.checkShiftAndLogout();
        }, 60000);
    }

    async checkShiftAndLogout() {
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;
        
        try {
            const staffDoc = await this.db.collection('staff').doc(userId).get();
            if (!staffDoc.exists) return;
            
            const staffData = staffDoc.data();
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            
            const [startHour, startMin] = staffData.shiftMulai.split(':').map(Number);
            const [endHour, endMin] = staffData.shiftSelesai.split(':').map(Number);
            
            const shiftStart = startHour * 60 + startMin;
            const shiftEnd = endHour * 60 + endMin;
            
            let isWithinShift;
            if (shiftEnd < shiftStart) {
                isWithinShift = currentTime >= shiftStart || currentTime <= shiftEnd;
            } else {
                isWithinShift = currentTime >= shiftStart && currentTime <= shiftEnd;
            }
            
            // Jika sudah lewat 30 menit dari shift selesai, auto logout
            if (!isWithinShift) {
                const shiftEndTime = shiftEnd < shiftStart ? shiftEnd + 1440 : shiftEnd;
                if (currentTime > shiftEndTime + 30) {
                    await this.autoLogout('Shift sudah selesai');
                }
            }
        } catch (error) {
            console.error('Error checking shift:', error);
        }
    }

    async autoLogout(reason) {
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            try {
                await this.db.collection('staff').doc(userId).update({
                    statusLogin: false,
                    lastLogout: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating logout status:', error);
            }
        }
        
        // Sign out
        await this.auth.signOut();
        
        // Clear storage
        sessionStorage.clear();
        localStorage.clear();
        
        // Redirect dengan pesan
        window.location.href = `index.html?message=${encodeURIComponent(reason)}`;
    }

    async logout() {
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            // Reset izin harian ke 0 saat logout
            await this.db.collection('staff').doc(userId).update({
                statusLogin: false,
                izinHariIni: 0,
                lastLogout: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Clear timers
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        if (this.shiftCheckTimer) clearInterval(this.shiftCheckTimer);
        
        // Sign out
        await this.auth.signOut();
        
        // Clear storage
        sessionStorage.clear();
        
        // Redirect
        window.location.href = 'index.html?message=Logout berhasil';
    }

    getCurrentUser() {
        return {
            id: sessionStorage.getItem('userId'),
            name: sessionStorage.getItem('userName'),
            role: sessionStorage.getItem('userRole'),
            jobdesk: sessionStorage.getItem('jobdesk'),
            shift: sessionStorage.getItem('shift')
        };
    }
}

// Buat instance global
window.authLogic = new AuthLogic();
