document.addEventListener('DOMContentLoaded', () => {
    const slotsGrid = document.getElementById('slots-grid');
    const datePicker = document.getElementById('booking-date');
    const sportBtns = document.querySelectorAll('.sport-btn');
    const groundOptions = document.querySelectorAll('input[name="ground"]');
    const bookingModal = document.getElementById('booking-modal');
    const closeModal = document.querySelector('.close-modal');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const bookingSummary = document.getElementById('booking-summary');
    const historyList = document.getElementById('booking-history-list');
    let user = null;
    auth.onAuthStateChanged(u => {
        user = u;
    });

    let selectedSport = 'football';
    let selectedGround = 'full';
    let selectedDate = null;
    let selectedSlots = []; // Array for multi-select
    let bookings = []; // Store fetched bookings for the date
    let pricingData = {
        football_full: 2000,
        football_half: 1200,
        cricket_full: 1800
    };
    let globalSettings = {
        status: 'open',
        disabledSlots: []
    };

    // Set today's date as min date and max to 10 days ahead (local)
    const todayLocal = new Date();
    const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;

    const maxDateLocal = new Date(todayLocal);
    maxDateLocal.setDate(maxDateLocal.getDate() + 15);
    const maxDate = `${maxDateLocal.getFullYear()}-${String(maxDateLocal.getMonth() + 1).padStart(2, '0')}-${String(maxDateLocal.getDate()).padStart(2, '0')}`;

    if (datePicker) {
        datePicker.min = today;
        datePicker.max = maxDate;
    }

    // Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Event Listeners
    sportBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sportBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSport = btn.dataset.sport;

            // Logic for Cricket: Only Full Ground
            const halfOptions = document.querySelectorAll('.half-option');
            if (selectedSport === 'cricket') {
                halfOptions.forEach(opt => opt.style.display = 'none');
                // Force select full ground
                const fullRadio = document.querySelector('input[name="ground"][value="full"]');
                if (fullRadio) {
                    fullRadio.checked = true;
                    selectedGround = 'full';
                }
            } else {
                halfOptions.forEach(opt => opt.style.display = 'block');
            }

            updatePriceLabels();
            renderSlots();
        });
    });

    groundOptions.forEach(opt => {
        opt.addEventListener('change', (e) => {
            selectedGround = e.target.value;
            renderSlots();
        });
    });

    if (datePicker) {
        datePicker.addEventListener('change', (e) => {
            selectedDate = e.target.value;
            fetchBookings();
            updatePriceLabels();
        });
    }

    const timeFilter = document.getElementById('time-filter');
    if (timeFilter) {
        timeFilter.addEventListener('change', () => {
            renderSlots();
        });
    }

    // Generate Slots (24 Hours)
    const allSlots = [];
    for (let i = 0; i < 24; i++) {
        const startHour = i % 12 || 12;
        const endHour = (i + 1) % 12 || 12;
        const startAmPm = i < 12 ? 'AM' : 'PM';
        const endAmPm = (i + 1) < 12 ? 'AM' : 'PM';

        let period = 'Morning';
        if (i >= 12 && i < 22) period = 'Evening';
        if (i >= 22 || i < 6) period = 'Night';

        const start = i < 10 ? `0${i}:00` : `${i}:00`;
        const end = (i + 1) < 10 ? `0${i + 1}:00` : (i + 1 === 24 ? '00:00' : `${i + 1}:00`);

        const label = `${String(startHour).padStart(2, '0')}:00 ${startAmPm} - ${String(endHour).padStart(2, '0')}:00 ${endAmPm} (${period})`;
        allSlots.push({ id: `${start}-${end}`, label: label, period: period.toLowerCase() });
    }

    // Fetch Bookings from Firestore
    async function fetchBookings() {
        if (!selectedDate) return;
        slotsGrid.innerHTML = '<p class="loading-text">Checking availability...</p>';

        try {
            const snapshot = await db.collection('bookings')
                .where('date', '==', selectedDate)
                .get();

            bookings = []; // Reset
            snapshot.forEach(doc => bookings.push(doc.data()));
            renderSlots();
        } catch (error) {
            console.error("Error fetching bookings:", error);
            slotsGrid.innerHTML = '<p class="error-msg">Failed to load slots.</p>';
        }
    }

    // Fetch Settings and Pricing
    async function initSettings() {
        try {
            const pDoc = await db.collection('settings').doc('pricing').get();
            if (pDoc.exists) pricingData = pDoc.data();

            const sDoc = await db.collection('settings').doc('global').get();
            if (sDoc.exists) globalSettings = sDoc.data();

            updatePriceLabels();
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    }

    // Render Slots with Logic
    function renderSlots() {
        slotsGrid.innerHTML = '';
        if (!selectedDate) {
            slotsGrid.innerHTML = '<p class="loading-text">Please select a date first.</p>';
            return;
        }

        if (globalSettings.status === 'closed') {
            slotsGrid.innerHTML = '<p class="error-msg" style="grid-column: 1/-1;">The turf is currently CLOSED for maintenance. Please check back later.</p>';
            return;
        }

        const filterTime = timeFilter ? timeFilter.value : 'all';

        allSlots.forEach(slot => {
            if (globalSettings.disabledSlots.includes(slot.id)) return; // Skip globally disabled slots
            if (filterTime !== 'all' && slot.period !== filterTime) return; // Filter by period

            const slotEl = document.createElement('div');
            slotEl.classList.add('slot');
            slotEl.textContent = slot.label;

            // Check if slot has already passed for today
            const now = new Date();
            const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const currentHour = now.getHours();

            let isPassed = false;
            if (selectedDate === todayDateStr) {
                const startHour = parseInt(slot.id.split(':')[0]);
                if (startHour <= currentHour) {
                    isPassed = true;
                }
            }

            if (isSlotBlocked(slot.id) || isPassed) {
                slotEl.classList.add('booked');
                slotEl.title = isPassed ? "Time Passed" : "Slot Unavailable";
            } else {
                // Multi-select toggle logic
                if (selectedSlots.some(s => s.id === slot.id)) {
                    slotEl.classList.add('selected');
                }

                slotEl.onclick = () => {
                    const index = selectedSlots.findIndex(s => s.id === slot.id);
                    if (index > -1) {
                        selectedSlots.splice(index, 1);
                        slotEl.classList.remove('selected');
                    } else {
                        selectedSlots.push(slot);
                        slotEl.classList.add('selected');
                    }
                    updateProceedButton();
                };
            }
            slotsGrid.appendChild(slotEl);
        });
    }

    function updateProceedButton() {
        const proceedBtn = document.getElementById('proceed-booking-btn');
        const container = document.getElementById('proceed-container');
        if (!proceedBtn || !container) return;

        if (selectedSlots.length > 0) {
            container.classList.remove('hidden');
            proceedBtn.textContent = `Proceed to Book (${selectedSlots.length} Selected)`;
        } else {
            container.classList.add('hidden');
        }
    }

    const proceedBtn = document.getElementById('proceed-booking-btn');
    if (proceedBtn) {
        proceedBtn.onclick = () => openBookingModal();
    }

    // CORE LOGIC: Check if slot is available based on ground type
    function isSlotBlocked(slotId) {
        // Filter bookings for this specific slot
        const slotBookings = bookings.filter(b => b.slot === slotId && b.status !== 'cancelled');

        if (slotBookings.length === 0) return false; // Completely free

        // Rule 1: If user wants 'full' ground
        if (selectedGround === 'full') {
            // If ANY booking exists (full, half_A, or half_B), it's blocked
            return true;
        }

        // Rule 2: If user wants 'half_A' (Ground half)
        if (selectedGround === 'half_A') {
            // Blocked if 'full' is booked OR if both 'half_A' AND 'half_B' are booked
            const hasFull = slotBookings.some(b => b.ground === 'full');
            const halfABooked = slotBookings.some(b => b.ground === 'half_A');
            const halfBBooked = slotBookings.some(b => b.ground === 'half_B');
            return hasFull || (halfABooked && halfBBooked);
        }

        return false;
    }

    function closeBooking() {
        if (bookingModal) bookingModal.style.display = 'none';
        selectedSlots = [];
        updateProceedButton();
        renderSlots();
    }

    // Open Booking Modal
    function openBookingModal() {
        if (!user) {
            alert("Please login to book a slot.");
            window.location.href = 'login.html';
            return;
        }

        if (selectedSlots.length === 0) return;

        const nameInput = document.getElementById('user-name');
        const mobileInput = document.getElementById('user-mobile');
        if (nameInput) nameInput.value = ''; // Clear name field
        if (mobileInput) mobileInput.value = ''; // Clear mobile field

        const totalPrice = calculatePrice();
        const slotLabels = selectedSlots.map(s => s.label).join(', ');

        bookingSummary.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Sport:</span>
                    <span style="font-weight: 600; text-transform: capitalize;">${selectedSport}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Ground:</span>
                    <span style="font-weight: 600; text-transform: capitalize;">${selectedGround.startsWith('half_') ? 'Ground half' : selectedGround}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Date:</span>
                    <span style="font-weight: 600;">${selectedDate}</span>
                </div>
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Slots:</span>
                    <span style="font-weight: 600; text-align: right; max-width: 60%">${slotLabels}</span>
                </div>
                <div style="margin-top: 10px; border-top: 1px solid var(--glass-border); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.1rem; font-weight: 700;">Total Amount:</span>
                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--secondary-color);">₹${totalPrice}</span>
                </div>
            </div>
        `;

        if (bookingModal) bookingModal.style.display = 'flex';
    }
    if (closeModal) {
        closeModal.onclick = () => bookingModal.style.display = 'none';
        window.onclick = (e) => {
            if (e.target == bookingModal) bookingModal.style.display = "none";
        }
    }

    // Dynamic Pricing (Fetch from Firestore)
    function calculatePrice() {
        if (!selectedDate) return 0;

        const date = new Date(selectedDate);
        const day = date.getDay(); // 0 is Sunday, 6 is Saturday
        const isWeekend = (day === 0 || day === 6);

        let perSlotPrice = 0;
        if (selectedSport === 'football') {
            if (selectedGround === 'full') {
                perSlotPrice = isWeekend ? pricingData.football_full_weekend : pricingData.football_full;
            } else {
                perSlotPrice = isWeekend ? pricingData.football_half_weekend : pricingData.football_half;
            }
        } else {
            // Cricket: Only Full ground supported
            perSlotPrice = isWeekend ? pricingData.cricket_full_weekend : pricingData.cricket_full;
        }
        return perSlotPrice * selectedSlots.length;
    }

    function updatePriceLabels() {
        const fullPriceLabel = document.getElementById('full-price');
        const halfPriceLabel = document.getElementById('half-price');

        if (!selectedDate) {
            if (fullPriceLabel) fullPriceLabel.textContent = "";
            if (halfPriceLabel) halfPriceLabel.textContent = "";
            return;
        }
        const date = new Date(selectedDate);
        const day = date.getDay();
        const isWeekend = (day === 0 || day === 6);

        if (selectedSport === 'football') {
            if (fullPriceLabel) fullPriceLabel.textContent = `(₹${isWeekend ? pricingData.football_full_weekend : pricingData.football_full})`;
            if (halfPriceLabel) halfPriceLabel.textContent = `(₹${isWeekend ? pricingData.football_half_weekend : pricingData.football_half})`;
        } else {
            if (fullPriceLabel) fullPriceLabel.textContent = `(₹${isWeekend ? pricingData.cricket_full_weekend : pricingData.cricket_full})`;
            if (halfPriceLabel) halfPriceLabel.textContent = `(₹${isWeekend ? pricingData.cricket_half_weekend : pricingData.cricket_half})`;
        }
    }

    // Initialize labels and settings
    initSettings();

    // Confirm Booking
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const nameInput = document.getElementById('user-name');
            const mobileInput = document.getElementById('user-mobile');
            const name = nameInput ? nameInput.value.trim() : '';
            const mobile = mobileInput ? mobileInput.value.trim() : '';

            if (name.length < 3) {
                alert("Please enter your full name (min 3 characters)");
                return;
            }

            if (mobile.length !== 10 || isNaN(mobile)) {
                alert("Please enter a valid 10-digit mobile number");
                return;
            }

            const totalPrice = calculatePrice();

            const options = {
                "key": "rzp_test_SCHxN9xA0UOkkG", // Replace with Live Key for production
                "amount": totalPrice * 100, // Amount in paise
                "currency": "INR",
                "name": "TurfSlot Premium",
                "description": `Booking for ${selectedSlots.length} slot(s)`,
                "handler": async function (response) {
                    try {
                        // Create individual records for each slot
                        const bookingPromises = selectedSlots.map(slot => {
                            // Automatically assign half_A or half_B
                            const slotBookings = bookings.filter(b => b.slot === slot.id && b.status !== 'cancelled');
                            let assignedGround = selectedGround;

                            // If booking a half ground, determine which half is available
                            if (selectedGround === 'half_A' || selectedGround === 'half_B') {
                                // Fetch current bookings for this specific slot to check conflicts
                                const slotBookings = bookings.filter(b => b.slot === slot.id && b.status !== 'cancelled');
                                const isHalfABooked = slotBookings.some(b => b.ground === 'half_A');
                                const isHalfBBooked = slotBookings.some(b => b.ground === 'half_B');

                                if (selectedGround === 'half_A' && !isHalfABooked) {
                                    assignedGround = 'half_A';
                                } else if (selectedGround === 'half_B' && !isHalfBBooked) {
                                    assignedGround = 'half_B';
                                } else if (!isHalfABooked) { // If user selected 'half_A' or 'half_B' but their preferred half is taken, try the other
                                    assignedGround = 'half_A';
                                } else if (!isHalfBBooked) {
                                    assignedGround = 'half_B';
                                } else {
                                    // This case should ideally be prevented by isSlotBlocked, but as a fallback
                                    throw new Error("Both half grounds are already booked for this slot.");
                                }
                            }

                            return db.collection('bookings').add({
                                userId: user.uid,
                                userName: name,
                                userEmail: user.email,
                                userMobile: mobile,
                                sport: selectedSport,
                                ground: assignedGround,
                                date: selectedDate,
                                slot: slot.id,
                                slotLabel: slot.label,
                                price: totalPrice / selectedSlots.length, // Price per slot
                                status: 'confirmed',
                                paymentId: response.razorpay_payment_id,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        });

                        await Promise.all(bookingPromises);
                        alert("Great! Your slots are booked successfully.");
                        window.location.href = 'bookings.html'; // Redirect to My Bookings
                    } catch (err) {
                        console.error("Booking Error:", err);
                        alert("Payment successful but booking failed. Please contact support.");
                    }
                },
                "prefill": {
                    "name": name,
                    "email": user.email,
                    "contact": mobile
                },
                "theme": {
                    "color": "#00b894"
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.description);
            });

            rzp1.open();
            // For simplicity, we'll reset it here, assuming the user will either complete payment
            // or close the Razorpay modal. A more robust solution might involve handling
            // Razorpay's close event.
            confirmBtn.disabled = false;
            confirmBtn.textContent = `Pay ₹${price} & Confirm`;
        };
    }

    // Load History
    function loadHistory() {
        if (!historyList || !auth.currentUser) return;

        db.collection('bookings')
            .where('userId', '==', auth.currentUser.uid)
            .get()
            .then(snapshot => {
                historyList.innerHTML = '';
                if (snapshot.empty) {
                    historyList.innerHTML = '<p>No bookings found.</p>';
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

                bookings.slice(0, 5).forEach(data => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <div>${data.date} | ${data.slotId}</div>
                        <div>${data.sport} (${data.groundType}) - ₹${data.price}</div>
                        <div style="color: ${data.status === 'confirmed' ? '#2ecc71' : 'red'}">${data.status}</div>
                    `;
                    item.style.borderBottom = "1px solid #444";
                    item.style.padding = "10px 0";
                    historyList.appendChild(item);
                });
            })
            .catch(err => {
                console.log("History fetch error:", err);
                historyList.innerHTML = '<p class="error-msg">Failed to load history.</p>';
            });
    }

    // Load history when auth is ready
    auth.onAuthStateChanged(user => {
        if (user) loadHistory();
    });
});
