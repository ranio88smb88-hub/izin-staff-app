// ==================== IZIN LOGIC ====================
// BATAS 4x IZIN PER HARI & 1 STAFF PER JOBDESK

class IzinLogic {
    constructor() {
        this.db = firebase.firestore();
        this.maxIzinPerHari = 4;
        this.durasiIzinKeluar = 959; // 15 menit 59 detik
        this.durasiIzinMakan = 420; // 7 menit
    }

    async checkDailyLimit(staffId) {
        const today = new Date().toISOString().split('T')[0];
        
        const izinToday = await this.db.collection('izin_logs')
            .where('staffId', '==', staffId)
            .where('tanggal', '==', today)
            .get();
        
        return izinToday.size;
    }

    async checkConcurrentIzin(jobdesk) {
        const activeIzin = await this.db.collection('izin_logs')
            .where('jobdesk', '==', jobdesk)
            .where('selesai', '==', false)
            .limit(1)
            .get();
        
        return !activeIzin.empty;
    }

    async requestIzin(staffId, type = 'keluar') {
        try {
            // 1. Ambil data staff
            const staffDoc = await this.db.collection('staff').doc(staffId).get();
            if (!staffDoc.exists) throw new Error('Staff tidak ditemukan');
            
            const staffData = staffDoc.data();
            
            // 2. Cek batas izin harian
            const izinCount = await this.checkDailyLimit(staffId);
            if (izinCount >= this.maxIzinPerHari) {
                throw new Error(`❌ Sudah mencapai batas ${this.maxIzinPerHari}x izin hari ini`);
            }
            
            // 3. Cek izin bersamaan di jobdesk yang sama
            const adaIzinAktif = await this.checkConcurrentIzin(staffData.jobdesk);
            if (adaIzinAktif) {
                throw new Error('⏳ Staff lain sedang izin di jobdesk ini');
            }
            
            // 4. Hitung durasi
            const durasi = type === 'keluar' ? this.durasiIzinKeluar : this.durasiIzinMakan;
            
            // 5. Buat izin
            const izinData = {
                staffId,
                nama: staffData.nama,
                jobdesk: staffData.jobdesk,
                waktuMulai: firebase.firestore.FieldValue.serverTimestamp(),
                waktuSelesai: null,
                durasi,
                status: 'ACTIVE',
                tanggal: new Date().toISOString().split('T')[0],
                type,
                selesai: false
            };
            
            await this.db.collection('izin_logs').add(izinData);
            
            // 6. Update counter
            await this.db.collection('staff').doc(staffId).update({
                izinHariIni: firebase.firestore.FieldValue.increment(1),
                sedangIzin: true
            });
            
            return { 
                success: true, 
                message: `✅ Izin ${type} berhasil. Sisa: ${this.maxIzinPerHari - izinCount - 1}x` 
            };
            
        } catch (error) {
            console.error('Izin error:', error);
            throw error;
        }
    }

    async endIzin(staffId) {
        await this.db.collection('staff').doc(staffId).update({
            sedangIzin: false
        });
    }
}

window.izinLogic = new IzinLogic();
