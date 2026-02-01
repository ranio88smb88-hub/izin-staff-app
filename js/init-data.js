// File: init-data.js
async function initStaffData() {
    const db = firebase.firestore();
    
    const staffList = [
        {
            nama: "Ranio",
            jabatan: "CS",
            jobdesk: "CS Line 1",
            shiftMulai: "14:45",
            shiftSelesai: "00:45",
            email: "ranio@perusahaan.com",
            password: "password123",
            role: "staff"
        },
        {
            nama: "Siti Aisyah",
            jabatan: "Operator",
            jobdesk: "Mesin 1",
            shiftMulai: "08:00",
            shiftSelesai: "16:00",
            email: "siti@perusahaan.com",
            password: "password123",
            role: "staff"
        },
        {
            nama: "Budi Santoso",
            jabatan: "Operator",
            jobdesk: "Mesin 2",
            shiftMulai: "16:00",
            shiftSelesai: "00:00",
            email: "budi@perusahaan.com",
            password: "password123",
            role: "staff"
        },
        {
            nama: "Admin Utama",
            jabatan: "Administrator",
            jobdesk: "Management",
            shiftMulai: "08:00",
            shiftSelesai: "17:00",
            email: "admin@perusahaan.com",
            password: "admin123",
            role: "admin"
        }
    ];
    
    console.log("📋 Mulai menambahkan staff...");
    
    for (const staff of staffList) {
        try {
            // Create auth user
            const userCredential = await firebase.auth()
                .createUserWithEmailAndPassword(staff.email, staff.password);
            
            // Save to Firestore
            await db.collection('staff').doc(userCredential.user.uid).set({
                nama: staff.nama,
                jabatan: staff.jabatan,
                jobdesk: staff.jobdesk,
                shiftMulai: staff.shiftMulai,
                shiftSelesai: staff.shiftSelesai,
                statusLogin: false,
                izinHariIni: 0,
                role: staff.role,
                email: staff.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ ${staff.nama} berhasil ditambahkan`);
            
        } catch (error) {
            console.error(`❌ Gagal menambahkan ${staff.nama}:`, error.message);
        }
    }
    
    console.log("🎉 Proses selesai!");
}
