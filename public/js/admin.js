document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const bookingsTableBody = document.getElementById('bookings-table-body');
    const datePicker = document.getElementById('admin-date-picker');
    const todayBookingsCount = document.getElementById('today-bookings-count');
    const todayRevenue = document.getElementById('today-revenue');
    const tabLinks = document.querySelectorAll('.sidebar nav a');
    const tabContents = document.querySelectorAll('.tab-content');

    // Forms
    const pricingForm = document.getElementById('pricing-form');
    const adminBookingForm = document.getElementById('admin-booking-form');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const turfStatusSelect = document.getElementById('turf-status-select');

    let modalBookings = []; // Storage for modal-specific bookings
    let pricingData = {}; // Global pricing storage
    let editingSlotId = null; // Track the slot of the booking being edited
    let globalDisabledSlots = []; // Storage for globally disabled slots from settings

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

    const timeFilter = document.getElementById('admin-time-filter');

    // Modal Elements
    const adminModal = document.getElementById('admin-modal');
    const modalSlotSelect = document.getElementById('modal-slot');



    // Set today's date (local)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (datePicker) datePicker.value = ''; // Clear to show all by default

    // Tab Navigation
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id === 'admin-logout') return;
            e.preventDefault();
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            link.classList.add('active');
            const tabId = link.getAttribute('data-tab');
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.add('active');
        });
    });

    // --- Booking CRUD ---
    function fetchAdminBookings() {
        if (!bookingsTableBody) return;
        const filterDate = datePicker.value;
        const filterTime = timeFilter ? timeFilter.value : 'all';
        bookingsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

        let query = db.collection('bookings').orderBy('timestamp', 'desc');
        if (filterDate) {
            query = db.collection('bookings').where('date', '==', filterDate);
        }

        query.get()
            .then(snapshot => {
                bookingsTableBody.innerHTML = '';
                let count = 0;
                let revenue = 0;

                if (snapshot.empty) {
                    bookingsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No bookings found.</td></tr>';
                } else {
                    snapshot.forEach(doc => {
                        const data = doc.data();

                        // Time Filter (Morning: 6-12, Evening: 12-22, Night: 22-06)
                        const slotHour = parseInt(data.slot ? data.slot.split(':')[0] : (data.slotId ? data.slotId.split(':')[0] : '0'));
                        let slotPeriod = 'morning';
                        if (slotHour >= 12 && slotHour < 22) slotPeriod = 'evening';
                        if (slotHour >= 22 || slotHour < 6) slotPeriod = 'night';

                        if (filterTime !== 'all' && filterTime !== slotPeriod) return;

                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${data.slotLabel || data.slot || data.slotId}</td>
                            <td>${data.sport.toUpperCase()}</td>
                            <td>${(data.ground || data.groundType || '').startsWith('half_') ? 'GROUND HALF' : (data.ground || data.groundType || '').toUpperCase()}</td>
                            <td>
                                <div style="font-weight: 600;">${data.userName || 'Guest'}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${data.userEmail}</div>
                            </td>
                            <td>${data.userMobile || data.mobile || '-'}</td>
                            <td><span class="status-${data.status}">${data.status}</span></td>
                            <td class="actions">
                                <button class="btn-small" onclick="openBookingModal('${doc.id}')">Edit</button>
                                <button class="btn-small danger" onclick="deleteBooking('${doc.id}')">Delete</button>
                            </td>
                        `;
                        bookingsTableBody.appendChild(row);

                        // Stats calculation (Always based on today's actual date)
                        if (data.date === todayStr && data.status === 'confirmed') {
                            count++;
                            revenue += data.price || 0;
                        }
                    });
                }

                if (todayBookingsCount) todayBookingsCount.textContent = count;
                if (todayRevenue) todayRevenue.textContent = `₹${revenue}`;
            });
    }

    window.openBookingModal = (docId) => {
        const title = document.getElementById('modal-title');
        const form = document.getElementById('admin-booking-form');
        const mDate = document.getElementById('modal-date');
        const mGround = document.getElementById('modal-ground');
        const mSport = document.getElementById('modal-sport');
        form.reset();
        document.getElementById('edit-doc-id').value = docId || '';
        editingSlotId = null; // Reset editing slot
        modalSlotSelect.innerHTML = '<option value="">Select a Slot</option>'; // Initial state
        title.textContent = docId ? 'Edit Booking' : 'Add New Booking';

        const handleSportChange = () => {
            const sport = mSport.value;
            const halfOptions = mGround.querySelectorAll('option[value^="half"]');
            if (sport === 'cricket') {
                halfOptions.forEach(opt => opt.style.display = 'none');
                mGround.value = 'full';
            } else {
                halfOptions.forEach(opt => opt.style.display = 'block');
            }
            if (updateSlotDisplay) updateSlotDisplay();
        };

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const maxDateLocal = new Date(now);
        maxDateLocal.setDate(maxDateLocal.getDate() + 15);
        const maxDateStr = `${maxDateLocal.getFullYear()}-${String(maxDateLocal.getMonth() + 1).padStart(2, '0')}-${String(maxDateLocal.getDate()).padStart(2, '0')}`;

        if (mDate) {
            mDate.min = todayStr;
            mDate.max = maxDateStr;
        }
        if (mSport) mSport.onchange = handleSportChange;

        const updateSlotDisplay = () => {
            const selectedDate = mDate.value;
            const selectedGround = mGround.value;
            const currentHour = now.getHours();

            const currentSelection = modalSlotSelect.value || editingSlotId;
            modalSlotSelect.innerHTML = '';

            // Add an initial empty option
            const emptyOpt = document.createElement('option');
            emptyOpt.value = "";
            emptyOpt.textContent = "Select a Slot";
            modalSlotSelect.appendChild(emptyOpt);

            allSlots.forEach(slot => {
                const slotId = slot.id;
                const startHour = parseInt(slotId.split(':')[0]);

                // 1. Check if disabled globally
                const isGloballyDisabled = globalDisabledSlots.includes(slotId);

                // 2. Check Temporal (Past Hour)
                let isDisabled = (selectedDate === todayStr && startHour <= currentHour) || isGloballyDisabled;

                // 3. Check Conflicts (if not editing or different slot)
                if (!isDisabled) {
                    const slotBookings = modalBookings.filter(b => b.slot === slotId && b.status !== 'cancelled');
                    const activeConflicts = docId ? slotBookings.filter(b => b.id !== docId) : slotBookings;

                    if (activeConflicts.length > 0) {
                        if (selectedGround === 'full') {
                            isDisabled = true;
                        } else if (selectedGround === 'half_A') {
                            const hasFull = activeConflicts.some(b => b.ground === 'full');
                            const halfABooked = activeConflicts.some(b => b.ground === 'half_A');
                            const halfBBooked = activeConflicts.some(b => b.ground === 'half_B');
                            isDisabled = hasFull || (halfABooked && halfBBooked);
                        }
                    }
                }

                // ONLY show if NOT disabled OR if it's the slot currently being edited
                if (!isDisabled || (docId && slotId === editingSlotId)) {
                    const opt = document.createElement('option');
                    opt.value = slot.id;
                    opt.textContent = slot.label;
                    modalSlotSelect.appendChild(opt);
                }
            });

            if (currentSelection) modalSlotSelect.value = currentSelection;
        };

        const fetchAndRefresh = async () => {
            if (!mDate.value) return;
            const snapshot = await db.collection('bookings').where('date', '==', mDate.value).get();
            modalBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateSlotDisplay();
        };

        const updateModalPrice = () => {
            if (!mDate.value || !mSport.value || !mGround.value) {
                document.getElementById('modal-price-display').textContent = "";
                return;
            }

            const date = new Date(mDate.value);
            const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
            let price = 0;

            if (mSport.value === 'football') {
                if (mGround.value === 'full') {
                    price = isWeekend ? pricingData.football_full_weekend : pricingData.football_full;
                } else {
                    price = isWeekend ? pricingData.football_half_weekend : pricingData.football_half;
                }
            } else {
                price = isWeekend ? pricingData.cricket_full_weekend : pricingData.cricket_full;
            }

            document.getElementById('modal-price-display').textContent = `(₹${price})`;
        };

        // Consolidated listeners
        const handleInputsChange = async () => {
            await fetchAndRefresh();
            updateModalPrice();
        };

        if (mDate) mDate.onchange = handleInputsChange;
        if (mSport) mSport.onchange = () => {
            handleSportChange();
            handleInputsChange();
        };
        if (mGround) mGround.onchange = () => {
            updateSlotDisplay();
            updateModalPrice();
        };

        if (docId) {
            db.collection('bookings').doc(docId).get().then(doc => {
                const data = doc.data();
                document.getElementById('modal-email').value = data.userEmail;
                document.getElementById('modal-mobile').value = data.userMobile || data.mobile || '';
                document.getElementById('modal-sport').value = data.sport;
                document.getElementById('modal-ground').value = data.ground || data.groundType || 'full';
                document.getElementById('modal-date').value = data.date;
                document.getElementById('modal-status').value = data.status;
                editingSlotId = data.slot || data.slotId || '';

                // Fetch bookings for this date then set slot
                fetchAndRefresh().then(() => {
                    document.getElementById('modal-slot').value = data.slot || data.slotId || '';
                });

                // Ensure ground filter is applied after data load
                handleSportChange();
                document.getElementById('modal-ground').value = data.ground || data.groundType || 'full';
                updateModalPrice();
            });
        } else {
            handleSportChange();
            updateModalPrice();
        }

        if (adminModal) adminModal.style.display = 'flex';
    };

    window.closeAdminModal = () => {
        if (adminModal) adminModal.style.display = 'none';
    };

    if (adminBookingForm) {
        adminBookingForm.onsubmit = (e) => {
            e.preventDefault();
            const docId = document.getElementById('edit-doc-id').value;
            const rawData = {
                userEmail: document.getElementById('modal-email').value,
                userMobile: document.getElementById('modal-mobile').value,
                sport: document.getElementById('modal-sport').value,
                ground: document.getElementById('modal-ground').value,
                date: document.getElementById('modal-date').value,
                slot: document.getElementById('modal-slot').value,
                slotLabel: document.getElementById('modal-slot').options[document.getElementById('modal-slot').selectedIndex].text,
                status: document.getElementById('modal-status').value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Automatically assign half_A or half_B if "half_A" (Ground half) is selected
            let assignedGround = rawData.ground;
            if (rawData.ground === 'half_A') {
                const slotBookings = modalBookings.filter(b => b.slot === rawData.slot && b.status !== 'cancelled' && b.id !== docId);
                const isHalfABooked = slotBookings.some(b => b.ground === 'half_A');
                assignedGround = isHalfABooked ? 'half_B' : 'half_A';
            }

            const data = { ...rawData, ground: assignedGround };
            const action = docId ? db.collection('bookings').doc(docId).update(data) : db.collection('bookings').add(data);
            action.then(() => {
                alert("Booking Saved");
                closeAdminModal();
                fetchAdminBookings();
            });
        };
    }

    window.deleteBooking = (docId) => {
        if (confirm("Delete this booking permanently?")) {
            db.collection('bookings').doc(docId).delete().then(() => {
                alert("Booking Deleted");
                fetchAdminBookings();
            });
        }
    };

    // --- Pricing Logic ---
    function loadPricing() {
        db.collection('settings').doc('pricing').get().then(doc => {
            if (doc.exists) {
                pricingData = doc.data();
                const p = pricingData;
                if (document.getElementById('price-fb-full')) document.getElementById('price-fb-full').value = p.football_full || 2000;
                if (document.getElementById('price-fb-half')) document.getElementById('price-fb-half').value = p.football_half || 1200;
                if (document.getElementById('price-ck-full')) document.getElementById('price-ck-full').value = p.cricket_full || 1800;

                // Weekend prices
                if (document.getElementById('price-fb-full-weekend')) document.getElementById('price-fb-full-weekend').value = p.football_full_weekend || 2500;
                if (document.getElementById('price-fb-half-weekend')) document.getElementById('price-fb-half-weekend').value = p.football_half_weekend || 1500;
                if (document.getElementById('price-ck-full-weekend')) document.getElementById('price-ck-full-weekend').value = p.cricket_full_weekend || 2200;
            }
        });
    }

    if (pricingForm) {
        pricingForm.onsubmit = (e) => {
            e.preventDefault();
            const data = {
                football_full: parseInt(document.getElementById('price-fb-full').value),
                football_half: parseInt(document.getElementById('price-fb-half').value),
                cricket_full: parseInt(document.getElementById('price-ck-full').value),
                football_full_weekend: parseInt(document.getElementById('price-fb-full-weekend').value),
                football_half_weekend: parseInt(document.getElementById('price-fb-half-weekend').value),
                cricket_full_weekend: parseInt(document.getElementById('price-ck-full-weekend').value)
            };
            db.collection('settings').doc('pricing').set(data).then(() => alert("Prices Updated"));
        };
    }

    // --- Settings & Slot Toggles ---
    function loadSettings() {
        db.collection('settings').doc('global').get().then(doc => {
            if (doc.exists) {
                if (turfStatusSelect) turfStatusSelect.value = doc.data().status || 'open';
                globalDisabledSlots = doc.data().disabledSlots || [];
                renderSlotToggles(globalDisabledSlots);
            } else {
                renderSlotToggles([]);
            }
        });
    }

    function renderSlotToggles(disabledSlots) {
        const grid = document.getElementById('slots-toggle-grid');
        if (!grid) return;
        grid.innerHTML = '';
        allSlots.forEach(slot => {
            const isEnabled = !disabledSlots.includes(slot.id);
            const div = document.createElement('div');
            div.className = 'slot-toggle-item';
            div.innerHTML = `
                <span style="font-size: 0.85rem;">${slot.label}</span>
                <input type="checkbox" class="slot-checkbox" value="${slot.id}" ${isEnabled ? 'checked' : ''}>
            `;
            grid.appendChild(div);
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = () => {
            const disabledSlots = [];
            document.querySelectorAll('.slot-checkbox').forEach(cb => {
                if (!cb.checked) disabledSlots.push(cb.value);
            });
            const data = {
                status: turfStatusSelect ? turfStatusSelect.value : 'open',
                disabledSlots: disabledSlots
            };
            db.collection('settings').doc('global').set(data).then(() => {
                alert("Settings Saved");
                globalDisabledSlots = disabledSlots; // Update local cache
            });
        };
    }

    // Event Listeners
    if (datePicker) datePicker.addEventListener('change', fetchAdminBookings);
    if (timeFilter) timeFilter.addEventListener('change', fetchAdminBookings);



    // Initial Loads (Run instantly)
    fetchAdminBookings();
    loadPricing();
    loadSettings();
});
