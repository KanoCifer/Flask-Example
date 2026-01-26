document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("light-dark-mode");
  const sunIcon = document.getElementById("icon-sun");
  const moonIcon = document.getElementById("icon-moon");
  const htmlElement = document.documentElement;

  const setTheme = (isDark) => {
    if (isDark) {
      htmlElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      sunIcon.classList.remove("hidden");
      moonIcon.classList.add("hidden");
    } else {
      htmlElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      sunIcon.classList.add("hidden");
      moonIcon.classList.remove("hidden");
    }
  };

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    setTheme(true);
  } else {
    setTheme(false);
  }

  toggleBtn.addEventListener("click", () => {
    const isDark = htmlElement.classList.contains("dark");
    setTheme(!isDark);
  });

  const flashMessages = document.querySelectorAll(".alert");
  if (flashMessages.length > 0) {
    setTimeout(() => {
      flashMessages.forEach((msg) => {
        msg.style.opacity = "0";
        setTimeout(() => {
          msg.remove();
        }, 500);
      });
    }, 3000);
  }
});
