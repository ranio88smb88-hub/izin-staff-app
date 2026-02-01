// ==================== REALTIME LOGIC ====================
// REALTIME UPDATES & NOTIFICATIONS

class RealtimeLogic {
    constructor() {
        this.db = firebase.firestore();
        this.listeners = [];
        this.timers = {};
    }

    // ==================== REALTIME MONITORING ====================

    // MONITOR STAFF SEDANG IZIN (REALTIME)
    monitorActiveIzin(callback) {
        console.log("👁️ Starting active izin monitoring...");
        
        const unsubscribe = this.db.collection('izin_logs')
            .where('selesai', '==', false)
            .orderBy('waktuMulai', 'asc')
            .onSnapshot(snapshot => {
                const activeIzin = [];
                const now = new Date();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const startTime = data.waktuMulai.toDate();
                    const elapsed = Math.floor((now - startTime) / 1000);
                    const remaining = Math.max(0, data.durasi - elapsed);
                    
                    activeIzin.push({
                        id: doc.id,
                        ...data,
                        elapsed: elapsed,
                        remaining: remaining,
                        isLate: elapsed > data.durasi,
                        minutesLeft: Math.floor(remaining / 60),
                        secondsLeft: remaining % 60,
                        startTime: startTime
                    });
                });
                
                console.log(`🔄 Active izin updated: ${activeIzin.length} staff`);
                callback(activeIzin);
                
            }, error => {
                console.error("❌ Active izin listener error:", error);
            });
        
        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    // MONITOR STAFF ONLINE (REALTIME)
    monitorOnlineStaff(callback) {
        console.log("👁️ Starting online staff monitoring...");
        
        const unsubscribe = this.db.collection('staff')
            .where('statusLogin', '==', true)
            .onSnapshot(snapshot => {
                const onlineStaff = [];
                
                snapshot.forEach(doc => {
                    onlineStaff.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log(`🔄 Online staff updated: ${onlineStaff.length} staff`);
                callback(onlineStaff);
                
            }, error => {
                console.error("❌ Online staff listener error:", error);
            });
        
        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    // MONITOR USER'S OWN ACTIVE IZIN
    monitorUserIzin(userId, callback) {
        console.log("👁️ Starting user izin monitoring for:", userId);
        
        const unsubscribe = this.db.collection('izin_logs')
            .where('staffId', '==', userId)
            .where('selesai', '==', false)
            .limit(1)
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const data = doc.data();
                    const now = new Date();
                    const startTime = data.waktuMulai.toDate();
                    const elapsed = Math.floor((now - startTime) / 1000);
                    const remaining = Math.max(0, data.durasi - elapsed);
                    
                    const izinData = {
                        id: doc.id,
                        ...data,
                        elapsed: elapsed,
                        remaining: remaining,
                        isLate: elapsed > data.durasi,
                        minutesLeft: Math.floor(remaining / 60),
                        secondsLeft: remaining % 60
                    };
                    
                    console.log("🔄 User izin updated:", izinData);
                    callback(izinData);
                } else {
                    console.log("🔄 User has no active izin");
                    callback(null);
                }
            }, error => {
                console.error("❌ User izin listener error:", error);
            });
        
        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    // ==================== NOTIFICATION SYSTEM ====================

    // KIRIM NOTIFIKASI
    async sendNotification(toUserId, message, type = 'info') {
        try {
            const notification = {
                to: toUserId,
                from: sessionStorage.getItem('userId') || 'system',
                fromName: sessionStorage.getItem('userName') || 'System',
                message: message,
                type: type, // info, warning, success, danger
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('notifications').add(notification);
            console.log("📩 Notification sent to:", toUserId, "Message:", message);
            return true;
        } catch (error) {
            console.error("❌ Error sending notification:", error);
            return false;
        }
    }

    // MONITOR NOTIFIKASI USER
    monitorUserNotifications(userId, callback) {
        const unsubscribe = this.db.collection('notifications')
            .where('to', '==', userId)
            .where('read', '==', false)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                const notifications = [];
                snapshot.forEach(doc => {
                    notifications.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log(`📥 Notifications updated: ${notifications.length} unread`);
                callback(notifications);
            }, error => {
                console.error("❌ Notifications listener error:", error);
            });
        
        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    // TANDAI NOTIFIKASI DIBACA
    async markNotificationRead(notificationId) {
        try {
            await this.db.collection('notifications').doc(notificationId).update({
                read: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("✅ Notification marked as read:", notificationId);
            return true;
        } catch (error) {
            console.error("❌ Error marking notification read:", error);
            return false;
        }
    }

    // ==================== TIMER & COUNTDOWN ====================

    // COUNTDOWN TIMER FOR ACTIVE IZIN
    startIzinCountdown(izinId, duration, updateCallback, finishCallback) {
        console.log("⏰ Starting countdown for izin:", izinId, "Duration:", duration);
        
        // Hapus timer sebelumnya jika ada
        if (this.timers[izinId]) {
            clearInterval(this.timers[izinId]);
        }
        
        let remaining = duration;
        
        const countdown = setInterval(() => {
            remaining--;
            
            if (remaining <= 0) {
                clearInterval(countdown);
                delete this.timers[izinId];
                
                if (finishCallback) {
                    console.log("⏰ Countdown finished for izin:", izinId);
                    finishCallback();
                }
                return;
            }
            
            // Format waktu: menit:detik
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Determine color based on remaining time
            let color = '#4CAF50'; // Green
            if (remaining < 300) color = '#FFA726'; // Orange (5 minutes)
            if (remaining < 60) color = '#F44336'; // Red (1 minute)
            
            if (updateCallback) {
                updateCallback(timeString, remaining, color);
            }
            
        }, 1000);
        
        this.timers[izinId] = countdown;
        return countdown;
    }

    // STOP COUNTDOWN TIMER
    stopIzinCountdown(izinId) {
        if (this.timers[izinId]) {
            clearInterval(this.timers[izinId]);
            delete this.timers[izinId];
            console.log("⏹️ Countdown stopped for izin:", izinId);
        }
    }

    // ==================== AUTO REFRESH & UPDATES ====================

    // AUTO REFRESH DATA SETIAP 30 DETIK
    startAutoRefresh(refreshCallback, interval = 30000) {
        console.log("🔄 Starting auto-refresh every", interval / 1000, "seconds");
        
        const refreshInterval = setInterval(() => {
            console.log("🔄 Auto-refresh triggered");
            if (refreshCallback) {
                refreshCallback();
            }
        }, interval);
        
        this.listeners.push(() => clearInterval(refreshInterval));
        return refreshInterval;
    }

    // UPDATE REALTIME CLOCK
    startRealtimeClock(updateCallback) {
        console.log("🕒 Starting real-time clock");
        
        const clockInterval = setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID');
            const dateString = now.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (updateCallback) {
                updateCallback(timeString, dateString);
            }
        }, 1000);
        
        this.listeners.push(() => clearInterval(clockInterval));
        return clockInterval;
    }

    // ==================== CLEANUP ====================

    // CLEANUP ALL LISTENERS & TIMERS
    cleanup() {
        console.log("🧹 Cleaning up all listeners and timers");
        
        // Stop all listeners
        this.listeners.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.error("Error unsubscribing:", error);
            }
        });
        this.listeners = [];
        
        // Stop all timers
        Object.values(this.timers).forEach(timer => {
            clearInterval(timer);
        });
        this.timers = {};
        
        console.log("✅ Cleanup completed");
    }

    // PAUSE ALL UPDATES
    pause() {
        console.log("⏸️ Pausing all real-time updates");
        this.cleanup();
    }

    // RESUME UPDATES
    resume() {
        console.log("▶️ Resuming real-time updates");
        // Note: Caller needs to re-setup listeners after resume
    }
}

// Buat instance global
window.realtimeLogic = new RealtimeLogic();
