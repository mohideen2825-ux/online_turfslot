// Auth State Listener
auth.onAuthStateChanged(user => {
    const authLink = document.getElementById('auth-link');
    const historyLink = document.getElementById('history-link');
    const loginForm = document.getElementById('login-form');
    // For admin dashboard check
    const currentPath = window.location.pathname;

    if (user) {
        if (authLink) {
            authLink.textContent = 'Logout';
            authLink.href = '#';
            authLink.classList.add('logout-mode');
            authLink.onclick = (e) => logout(e);
        }
        if (historyLink) historyLink.style.display = 'block';

        if (currentPath.includes('login.html')) {
            checkUserRole(user).then(role => {
                if (role === 'admin') window.location.href = 'admin.html';
                else window.location.href = 'index.html';
            });
        }
    } else {
        if (authLink) {
            authLink.textContent = 'Login';
            authLink.href = 'login.html';
            authLink.classList.remove('logout-mode');
            authLink.onclick = null;
        }
        if (historyLink) historyLink.style.display = 'none';

        if (currentPath.includes('admin.html') || currentPath.includes('bookings.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Login Function
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('auth-error');

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                console.log("Logged in");
                // Navigation handled by onAuthStateChanged
            })
            .catch((error) => {
                errorMsg.textContent = error.message;
            });
    });
}

// Signup Function
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const name = document.getElementById('signup-name').value;
        const errorMsg = document.getElementById('auth-error');

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                // Add user to Firestore
                db.collection('users').doc(user.uid).set({
                    email: email,
                    name: name,
                    role: 'user' // Default role
                }).then(() => {
                    // Check if it's the specific admin email (demo purpose)
                    if (email === 'admin@turfzone.com') { // Hardcoded admin for demo
                        db.collection('users').doc(user.uid).update({ role: 'admin' });
                    }
                });
            })
            .catch((error) => {
                errorMsg.textContent = error.message;
            });
    });
}

// Logout Function
function logout(e) {
    if (e) e.preventDefault();
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Logout Error:', error);
    });
}

// Google Login
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                // Check if user exists in Firestore, if not create
                const userRef = db.collection('users').doc(user.uid);
                userRef.get().then((doc) => {
                    if (!doc.exists) {
                        userRef.set({
                            email: user.email,
                            name: user.displayName,
                            role: 'user'
                        });
                    }
                });
                console.log("Google Logged in");
            }).catch((error) => {
                console.error("Google Login Error:", error);
                const errorMsg = document.getElementById('auth-error');
                if (errorMsg) errorMsg.textContent = error.message;
            });
    });
}

// Admin Logout
const adminLogout = document.getElementById('admin-logout');
if (adminLogout) {
    adminLogout.addEventListener('click', logout);
}

// Check Role Helper
async function checkUserRole(user) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
        return doc.data().role;
    } else {
        return 'user';
    }
}

// Universal Navbar Logic
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links a');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });

        // Navbar Scroll Effect (Global)
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (navbar) {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }
        });
    }
});
// Password Toggle Logic
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function () {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);

        if (input.type === 'password') {
            input.type = 'text';
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
        }
    });
});

// Forgot Password Flow
const forgotPasswordLink = document.getElementById('forgot-password');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            alert("Please enter your registered email address in the email field first.");
            if (emailInput) emailInput.focus();
            return;
        }

        // Check if user exists in Firestore before sending reset link
        db.collection('users').where('email', '==', email).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    alert("This email address is not registered. Please sign up first.");
                    return;
                }

                auth.sendPasswordResetEmail(email)
                    .then(() => {
                        alert("Password reset email sent to " + email + "! Please check your inbox.");
                    })
                    .catch((error) => {
                        alert("Error: " + error.message);
                    });
            })
            .catch(error => {
                console.error("Error checking user registration:", error);
                alert("An error occurred. Please try again.");
            });
    });
}
