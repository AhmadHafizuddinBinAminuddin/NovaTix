
/* =========================================
   NOVATIX — AUTHENTICATION
   Connects login and registration to the PHP API
   ========================================= */

const API_BASE = "../api.php";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");

const loginSubmit = document.getElementById("loginSubmit");
const registerSubmit = document.getElementById("registerSubmit");


/* =========================================
   FEEDBACK
   ========================================= */

function showMessage(element, message, type = "error") {
    element.textContent = message;
    element.className = `alert alert-${type}`;
}

function clearMessage(element) {
    element.textContent = "";
    element.className = "alert hidden";
}


/* =========================================
   LOGIN AND REGISTRATION MODE
   ========================================= */

function showAuthMode(mode) {
    const isRegister = mode === "register";

    loginPanel.classList.toggle("hidden", isRegister);
    registerPanel.classList.toggle("hidden", !isRegister);

    clearMessage(loginMessage);
    clearMessage(registerMessage);

    const url = new URL(window.location.href);

    url.searchParams.set(
        "mode",
        isRegister ? "register" : "login"
    );

    window.history.replaceState({}, "", url);
}

document.getElementById("goToRegister").addEventListener("click", event => {
    event.preventDefault();
    showAuthMode("register");
});

document.getElementById("goToLogin").addEventListener("click", event => {
    event.preventDefault();
    showAuthMode("login");
});


/* =========================================
   SEND JSON REQUESTS
   ========================================= */

async function sendRequest(endpoint, body) {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(body)
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result.success !== true) {
        throw new Error(
            result.message || `Request failed (${response.status}).`
        );
    }

    return result;
}


/* =========================================
   CUSTOMER LOGIN
   ========================================= */

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage(loginMessage);

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in...";

    try {
        const result = await sendRequest("login", {
            email,
            password
        });

        if (
            typeof result.access_token !== "string" ||
            !result.access_token ||
            !result.data ||
            !result.data.user_id ||
            !result.data.role
        ) {
            throw new Error(
                "The login response is missing required account information."
            );
        }

        const user = {
            user_id: result.data.user_id,
            full_name: result.data.full_name,
            email: result.data.email,
            role: result.data.role
        };

        // Store the returned token and basic account details.
        localStorage.setItem("novatix_token", result.access_token);
        localStorage.setItem("novatix_user", JSON.stringify(user));

        showMessage(
            loginMessage,
            `Welcome back, ${user.full_name}! Redirecting...`,
            "success"
        );

        window.setTimeout(() => {
            const pendingEventId =
                localStorage.getItem("novatix_pending_event");

            if (pendingEventId && user.role === "Customer") {
                window.location.href =
                    "index.html?login=success&continueBooking=1";
            } else {
                if (pendingEventId) {
                    localStorage.removeItem("novatix_pending_event");
                }

                window.location.href = "index.html?login=success";
            }
        }, 700);

    } catch (error) {
        showMessage(
            loginMessage,
            error.message || "Unable to sign in. Please try again."
        );
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = "Sign In →";
    }
});


/* =========================================
   CUSTOMER REGISTRATION
   The backend creates Customer accounts only.
   ========================================= */

registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage(registerMessage);

    const fullName =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    if (fullName.length === 0 || fullName.length > 100) {
        showMessage(
            registerMessage,
            "Please enter a name between 1 and 100 characters."
        );
        return;
    }

    if (password !== confirmPassword) {
        showMessage(registerMessage, "The passwords do not match.");
        return;
    }

    const passwordBytes = new TextEncoder().encode(password).length;

    if (passwordBytes < 8 || passwordBytes > 72) {
        showMessage(
            registerMessage,
            "Your password must be between 8 and 72 bytes."
        );
        return;
    }

    registerSubmit.disabled = true;
    registerSubmit.textContent = "Creating account...";

    try {
        const result = await sendRequest("users", {
            full_name: fullName,
            email,
            password
        });

        showMessage(
            registerMessage,
            result.message || "Account created successfully. Please sign in.",
            "success"
        );

        // Move the email into the login form.
        document.getElementById("loginEmail").value = email;
        registerForm.reset();

        window.setTimeout(() => {
            showAuthMode("login");

            showMessage(
                loginMessage,
                "Your account is ready. Please sign in.",
                "success"
            );

            document.getElementById("loginPassword").focus();
        }, 900);

    } catch (error) {
        showMessage(
            registerMessage,
            error.message ||
            "Unable to create the account. Please try again."
        );
    } finally {
        registerSubmit.disabled = false;
        registerSubmit.textContent = "Create Account →";
    }
});


/* =========================================
   INITIAL PAGE SETUP
   ========================================= */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

const params = new URLSearchParams(window.location.search);

showAuthMode(
    params.get("mode") === "register" ? "register" : "login"
);

// Optional email prefill.
if (params.get("registeredEmail")) {
    document.getElementById("loginEmail").value =
        params.get("registeredEmail");
}
