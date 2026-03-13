document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('booking-history-list');

    // Load History
    function loadHistory() {
        if (!historyList || !auth.currentUser) return;

        console.log("Loading history for user:", auth.currentUser.uid);

        db.collection('bookings')
            .where('userId', '==', auth.currentUser.uid)
            .get()
            .then(snapshot => {
                historyList.innerHTML = '';
                if (snapshot.empty) {
                    historyList.innerHTML = '<p class="text-center">No bookings found.</p>';
                    return;
                }

                let bookings = [];
                snapshot.forEach(doc => bookings.push(doc.data()));

                // Sort by timestamp desc locally
                bookings.sort((a, b) => {
                    const timeA = a.timestamp ? a.timestamp.seconds : 0;
                    const timeB = b.timestamp ? b.timestamp.seconds : 0;
                    return timeB - timeA;
                });

                bookings.forEach(data => {
                    const item = document.createElement('div');
                    item.className = 'history-item fade-in';
                    item.innerHTML = `
                        <div>${data.date} | ${data.slotLabel || data.slot}</div>
                        <div>${data.sport.toUpperCase()} (${(data.ground || data.groundType || '').replace('_', ' ')}) - ₹${data.price}</div>
                        <div style="color: ${data.status === 'confirmed' ? 'var(--secondary-color)' : 'var(--danger-color)'}; font-weight: bold;">${data.status.toUpperCase()}</div>
                    `;
                    historyList.appendChild(item);
                });
            })
            .catch(err => {
                console.error("History fetch error:", err);
                historyList.innerHTML = '<p class="error-msg text-center">Failed to load history.</p>';
            });
    }

    // Load history when auth is ready
    auth.onAuthStateChanged(user => {
        if (user) {
            loadHistory();
        } else {
            historyList.innerHTML = '<p class="text-center">Please login to view bookings.</p>';
        }
    });
});
