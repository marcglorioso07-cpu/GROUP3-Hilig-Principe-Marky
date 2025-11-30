document.addEventListener("DOMContentLoaded", () => {
  const ns = window.firebaseNS;
  if (!ns) return;

  const {
    auth,
    db,
    createUserWithEmailAndPassword,
    updateProfile,
    doc,
    setDoc
  } = ns;

  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("studentEmail").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const terms = document.getElementById("terms");

    if (!terms.checked) {
      showError("You must agree to the Terms and Privacy Policy.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    const btn = document.getElementById("createAccountBtn");
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Creating...';
    btn.disabled = true;

    try {
      // CREATE AUTH USER
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // Update auth profile
      await updateProfile(user, { displayName: fullName });

      // SAVE TO FIRESTORE (must match your security rules)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        username: fullName,
        avatarUrl: ""
      });

      alert("Account created successfully!");
      window.location.href = "login.html";

    } catch (err) {
      console.error(err);
      showError(err.message);
    } finally {
      btn.innerHTML = "Create Account";
      btn.disabled = false;
    }
  });

  function showError(msg) {
    const errorBox = document.getElementById("formError");
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = "block";
    } else {
      alert(msg);
    }
  }
});
