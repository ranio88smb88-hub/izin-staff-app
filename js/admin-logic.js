// ==================== ADMIN LOGIC ====================
// MENU PENGATURAN ADMIN (FULL CONTROL)

class AdminLogic {
    constructor() {
        this.db = firebase.firestore();
    }

    // ==================== PENGATURAN ====================

    // MENGATUR SETTINGS
    async updateSettings(settings) {
        try {
            await this.db.collection('pengaturan').doc('config').set(settings, { merge: true });
            console.log("⚙️ Settings updated:", settings);
            return { success: true, message: 'Pengaturan berhasil diperbarui' };
        } catch (error) {
            console.error("❌ Error updating settings:", error);
            throw error;
        }
    }

    // MENGATUR BATAS IZIN HARIAN
    async updateMaxIzin(maxIzin) {
        const settings = { maxIzinPerHari: parseInt(maxIzin) || 4 };
        return await this.updateSettings(settings);
    }

    // MENGATUR DURASI IZIN
    async updateDurations(keluarSeconds, makanSeconds) {
        const settings = {
            durasiIzinKeluar: parseInt(keluarSeconds) || 959,
            durasiIzinMakan: parseInt(makanSeconds) || 420
        };
        return await this.updateSettings(settings);
    }

    // MENGATUR IZIN BERSAMAAN
    async updateConcurrentPermission(allowed) {
        const settings = { allowConcurrent: !!allowed };
        return await this.updateSettings(settings);
    }

    // MENGATUR SESSION TIMEOUT
    async updateSessionTimeout(hours) {
        const settings = { sessionTimeout: hours * 3600 }; // Konversi ke detik
        return await this.updateSettings(settings);
    }

    // MENGATUR NAMA PERUSAHAAN & LOGO
    async updateCompanyInfo(namaPerusahaan, logoUrl, aturanSanksi) {
        const settings = {
            namaPerusahaan: namaPerusahaan || '',
            logoUrl: logoUrl || '',
            aturanSanksi: aturanSanksi || ''
        };
        return await this.updateSettings(settings);
    }

    // MENDAPATKAN SETTINGS
    async getSettings() {
        try {
            const doc = await this.db.collection('pengaturan').doc('config').get();
            if (doc.exists) {
                return doc.data();
            }
            return {
                maxIzinPerHari: 4,
                durasiIzinKeluar: 959,
                durasiIzinMakan: 420,
                allowConcurrent: false,
                sessionTimeout: 28800,
                namaPerusahaan: 'Perusahaan Anda',
                logoUrl: '',
                aturanSanksi: ''
            };
        } catch (error) {
            console.error("❌ Error getting settings:", error);
            return null;
        }
    }

    // ==================== MANAJEMEN STAFF ====================

    // MENDAPATKAN SEMUA STAFF
    async getAllStaff() {
        try {
            const snapshot = await this.db.collection('staff').get();
            const staffList = [];
            
            snapshot.forEach(doc => {
                staffList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`👥 Loaded ${staffList.length} staff members`);
            return staffList;
            
        } catch (error) {
            console.error("❌ Error getting all staff:", error);
            return [];
        }
    }

    // MENAMBAH STAFF BARU
    async addStaff(staffData) {
        try {
            // Validasi data
            if (!staffData.email || !staffData.password) {
                throw new Error('Email dan password harus diisi');
            }
            
            if (!staffData.nama || !staffData.jobdesk) {
                throw new Error('Nama dan jobdesk harus diisi');
            }
            
            console.log("👤 Adding new staff:", staffData);
            
            // 1. Create user di Firebase Auth
            const userCredential = await firebase.auth()
                .createUserWithEmailAndPassword(staffData.email, staffData.password);
            
            const userId = userCredential.user.uid;
            
            // 2. Simpan data staff di Firestore
            const staffRecord = {
                nama: staffData.nama,
                jabatan: staffData.jabatan || 'Staff',
                jobdesk: staffData.jobdesk,
                shiftMulai: staffData.shiftMulai || '08:00',
                shiftSelesai: staffData.shiftSelesai || '16:00',
                statusLogin: false,
                izinHariIni: 0,
                role: staffData.role || 'staff',
                email: staffData.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('staff').doc(userId).set(staffRecord);
            
            console.log("✅ Staff added successfully, ID:", userId);
            
            return { 
                success: true, 
                message: 'Staff berhasil ditambahkan',
                userId: userId
            };
            
        } catch (error) {
            console.error("❌ Error adding staff:", error);
            
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Email sudah terdaftar');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password terlalu lemah (minimal 6 karakter)');
            }
            
            throw error;
        }
    }

    // MENGUPDATE DATA STAFF
    async updateStaff(staffId, staffData) {
        try {
            const updateData = {
                ...staffData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Hapus fields yang tidak boleh diupdate
            delete updateData.id;
            delete updateData.email;
            delete updateData.createdAt;
            
            await this.db.collection('staff').doc(staffId).update(updateData);
            
            console.log("✅ Staff updated:", staffId);
            return { success: true, message: 'Data staff berhasil diperbarui' };
            
        } catch (error) {
            console.error("❌ Error updating staff:", error);
            throw error;
        }
    }

    // MENGHAPUS STAFF
    async deleteStaff(staffId) {
        try {
            // 1. Hapus dari Firestore
            await this.db.collection('staff').doc(staffId).delete();
            
            console.log("🗑️ Staff deleted from Firestore:", staffId);
            
            // Note: Untuk hapus dari Firebase Auth, perlu Cloud Functions
            return { 
                success: true, 
                message: 'Staff berhasil dihapus dari sistem',
                note: 'Akun login masih aktif, hubungi admin untuk reset password'
            };
            
        } catch (error) {
            console.error("❌ Error deleting staff:", error);
            throw error;
        }
    }

    // ==================== LAPORAN & ANALYTICS ====================

    // MENDAPATKAN LAPORAN IZIN
    async getIzinReport(startDate, endDate, staffId = null) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            let query = this.db.collection('izin_logs')
                .where('waktuMulai', '>=', start)
                .where('waktuMulai', '<=', end)
                .orderBy('waktuMulai', 'desc');
            
            if (staffId) {
                query = query.where('staffId', '==', staffId);
            }
            
            const snapshot = await query.get();
            const reports = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                reports.push({
                    id: doc.id,
                    ...data,
                    waktuMulai: data.waktuMulai?.toDate(),
                    waktuSelesai: data.waktuSelesai?.toDate()
                });
            });
            
            // Hitung statistik
            const stats = {
                total: reports.length,
                normal: reports.filter(r => r.status === 'NORMAL').length,
                telat: reports.filter(r => r.status === 'TELAT').length,
                keluar: reports.filter(r => r.type === 'keluar').length,
                makan: reports.filter(r => r.type === 'makan').length,
                
                byJobdesk: this.groupBy(reports, 'jobdesk'),
                byStaff: this.groupBy(reports, 'nama'),
                byDay: this.groupByDate(reports),
                
                avgDuration: this.calculateAverageDuration(reports)
            };
            
            console.log(`📊 Report generated: ${reports.length} records from ${startDate} to ${endDate}`);
            
            return { reports, stats };
            
        } catch (error) {
            console.error("❌ Error generating report:", error);
            throw error;
        }
    }

    // MENDAPATKAN DASHBOARD STATS
    async getDashboardStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Hitung semua stats paralel
            const [
                totalStaff,
                onlineStaff,
                activeIzin,
                todayIzin
            ] = await Promise.all([
                this.db.collection('staff').count().get(),
                this.db.collection('staff').where('statusLogin', '==', true).count().get(),
                this.db.collection('izin_logs').where('selesai', '==', false).count().get(),
                this.db.collection('izin_logs').where('tanggal', '==', today).count().get()
            ]);
            
            const stats = {
                totalStaff: totalStaff.data().count,
                onlineStaff: onlineStaff.data().count,
                activeIzin: activeIzin.data().count,
                todayIzin: todayIzin.data().count,
                offlineStaff: totalStaff.data().count - onlineStaff.data().count
            };
            
            return stats;
            
        } catch (error) {
            console.error("❌ Error getting dashboard stats:", error);
            return {
                totalStaff: 0,
                onlineStaff: 0,
                activeIzin: 0,
                todayIzin: 0,
                offlineStaff: 0
            };
        }
    }

    // ==================== HELPER FUNCTIONS ====================

    groupBy(array, key) {
        return array.reduce((result, item) => {
            const groupKey = item[key] || 'Unknown';
            if (!result[groupKey]) {
                result[groupKey] = 0;
            }
            result[groupKey]++;
            return result;
        }, {});
    }

    groupByDate(array) {
        return array.reduce((result, item) => {
            if (!item.waktuMulai) return result;
            
            const dateKey = item.waktuMulai.toISOString().split('T')[0];
            if (!result[dateKey]) {
                result[dateKey] = 0;
            }
            result[dateKey]++;
            return result;
        }, {});
    }

    calculateAverageDuration(array) {
        const durations = array
            .filter(item => item.durasi && item.durasi > 0)
            .map(item => item.durasi);
        
        if (durations.length === 0) return 0;
        
        const sum = durations.reduce((a, b) => a + b, 0);
        return Math.floor(sum / durations.length);
    }

    // FORMATTERS
    formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatTime(date) {
        return new Date(date).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Buat instance global
window.adminLogic = new AdminLogic();
