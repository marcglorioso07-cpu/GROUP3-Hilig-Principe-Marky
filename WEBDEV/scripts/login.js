/* scripts/login.js */
/* Login + Register + Forgot Password using Firebase Auth */

document.addEventListener("DOMContentLoaded", () => {
  // when true we skip auto-redirect after just creating an account
  window.blockRedirect = false;

  const ns = window.firebaseNS;
  if (!ns) return;

  const {
    auth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
  } = ns;

  // --------- VIEW ELEMENTS ---------
  const loginCard    = document.getElementById("loginCard");
  const registerCard = document.getElementById("registerCard");
  const resetCard    = document.getElementById("resetCard");

  const showRegisterLink = document.getElementById("showRegister");
  const showResetLink    = document.getElementById("showReset");
  const backFromRegister = document.getElementById("backToLoginFromRegister");
  const backFromReset    = document.getElementById("backToLoginFromReset");

  const loginEmailInput  = document.getElementById("loginEmail");

  function showView(view) {
    if (loginCard)    loginCard.style.display    = view === "login"    ? "block" : "none";
    if (registerCard) registerCard.style.display = view === "register" ? "block" : "none";
    if (resetCard)    resetCard.style.display    = view === "reset"    ? "block" : "none";
  }

  // default
  showView("login");

  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", (e) => {
      e.preventDefault();
      showView("register");
    });
  }
  if (showResetLink) {
    showResetLink.addEventListener("click", (e) => {
      e.preventDefault();
      showView("reset");
    });
  }
  if (backFromRegister) {
    backFromRegister.addEventListener("click", (e) => {
      e.preventDefault();
      showView("login");
    });
  }
  if (backFromReset) {
    backFromReset.addEventListener("click", (e) => {
      e.preventDefault();
      showView("login");
    });
  }

  // --------- COMMON HELPERS ---------
  async function finishLogin() {
    try {
      await window.getCurrentUserProfile?.();
    } catch (e) {
      console.error("Profile setup error:", e);
    }
    window.location.href = "index.html";
  }

  function setError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
  }

  // Already logged in → go to homepage (except right after registration)
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    if (window.blockRedirect === true) return;
    window.location.href = "index.html";
  });

  // --------- LOGIN (EMAIL / PASSWORD) ---------
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("loginError", "");

      const btn = loginForm.querySelector(".btn-login");
      const email = loginEmailInput?.value.trim();
      const password = document.getElementById("loginPassword")?.value.trim();

      if (!email || !password) {
        setError("loginError", "Please enter email and password.");
        return;
      }

      if (btn) {
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Signing in...';
        btn.disabled = true;
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
        await finishLogin();
      } catch (err) {
        console.error(err);
        setError("loginError", err.message || "Login failed.");
      } finally {
        if (btn) {
          btn.innerHTML = "Login";
          btn.disabled = false;
        }
      }
    });
  }

  // --------- REGISTER (EMAIL / PASSWORD) ---------
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      [
        "regFullNameError",
        "regEmailError",
        "regStudentIdError",
        "regPasswordError",
        "regConfirmPasswordError",
        "regTermsError",
        "regGeneralError"
      ].forEach(id => setError(id, ""));

      const fullName    = document.getElementById("regFullName")?.value.trim();
      const email       = document.getElementById("regEmail")?.value.trim();
      const studentId   = document.getElementById("regStudentId")?.value.trim();
      const password    = document.getElementById("regPassword")?.value;
      const confirmPass = document.getElementById("regConfirmPassword")?.value;
      const terms       = document.getElementById("regTerms")?.checked;

      let valid = true;

      if (!fullName)  { setError("regFullNameError", "Enter your full name."); valid = false; }
      if (!email)     { setError("regEmailError", "Enter email."); valid = false; }
      if (!studentId) { setError("regStudentIdError", "Enter student ID."); valid = false; }
      if (!password || password.length < 6) {
        setError("regPasswordError", "Password must be at least 6 characters.");
        valid = false;
      }
      if (password !== confirmPass) {
        setError("regConfirmPasswordError", "Passwords do not match.");
        valid = false;
      }
      if (!terms) {
        setError("regTermsError", "You must accept the terms.");
        valid = false;
      }

      if (!valid) return;

      const btn = registerForm.querySelector(".btn-login");
      if (btn) {
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Creating...';
        btn.disabled = true;
      }

      try {
        // prevent redirect caused by onAuthStateChanged
        window.blockRedirect = true;

        await createUserWithEmailAndPassword(auth, email, password);

        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: fullName });
        }

        // sign out newly-created user → they must login manually
        await auth.signOut();

        // back to login, pre-fill email
        showView("login");
        if (loginEmailInput) loginEmailInput.value = email;
        setError("loginError", "Account created! Please sign in.");

        // auto-hide after 3s
        setTimeout(() => setError("loginError", ""), 3000);
      } catch (err) {
        console.error(err);
        setError("regGeneralError", err.message || "Registration failed.");
      } finally {
        if (btn) {
          btn.innerHTML = "Create Account";
          btn.disabled = false;
        }
      }
    });
  }

  // --------- GOOGLE LOGIN ---------
  function attachGoogle(btn) {
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Connecting...';
      btn.disabled = true;
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        await finishLogin();
      } catch (err) {
        console.error(err);
      } finally {
        btn.innerHTML = '<i class="ri-google-fill"></i><span>Continue with Google</span>';
        btn.disabled = false;
      }
    });
  }

  attachGoogle(document.getElementById("googleLogin"));
  attachGoogle(document.getElementById("googleRegister"));

  // (Facebook buttons are removed from HTML; this code will just do nothing.)

  // --------- FORGOT PASSWORD ---------
  const resetForm = document.getElementById("resetForm");
  const resetBtn  = document.getElementById("resetSubmitBtn");

  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("resetError", "");
      setError("resetSuccess", "");

      const email = document.getElementById("resetEmail")?.value.trim();
      if (!email) {
        setError("resetError", "Please enter your email.");
        return;
      }

      if (resetBtn) {
        resetBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Sending...';
        resetBtn.disabled = true;
      }

      try {
        // THIS actually sends the reset email now ✅
        await sendPasswordResetEmail(auth, email);

        setError("resetSuccess", "Reset instructions sent to your email.");

        // also pre-fill login email when they go back
        if (loginEmailInput) loginEmailInput.value = email;
      } catch (err) {
        console.error(err);
        setError("resetError", err.message || "Failed to send reset email.");
      } finally {
        if (resetBtn) {
          resetBtn.innerHTML = "Send Reset Instructions";
          resetBtn.disabled = false;
        }
      }
    });
  }
});
