(() => {
  const link = document.querySelector(".contact-email");
  const note = document.getElementById("contactCopied");
  if (!link || !note || !navigator.clipboard) return;

  note.textContent = "copied!";

  // Desktop mailto often opens an unused mail app or nothing, so copy as a fallback.
  link.addEventListener("click", () => {
    navigator.clipboard.writeText("natanmoura@gmail.com").then(() => {
      note.classList.remove("is-shown");
      void note.offsetWidth;
      note.classList.add("is-shown");
    }).catch(() => {});
  });
})();
