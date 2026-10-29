const status = document.getElementById("status");
chrome.runtime.sendMessage({ type: "status" }).then((s) => {
  document.getElementById("ordersUrl").value = s.ordersUrl;
  document.getElementById("accountKey").value = s.accountKey;
});
document.getElementById("config").onsubmit = async (e) => {
  e.preventDefault();
  const r = await chrome.runtime.sendMessage({
    type: "configure",
    token: document.getElementById("token").value.trim(),
    ordersUrl: document.getElementById("ordersUrl").value.trim(),
    accountKey: document.getElementById("accountKey").value.trim(),
  });
  status.textContent =
    r.error || "Enregistré. Ouvre l’icône Mentora et clique sur Démarrer.";
  if (!r.error) document.getElementById("token").value = "";
};
document.getElementById("forget").onclick = async () => {
  if (!confirm("Effacer la clé de cet ordinateur et arrêter la lecture ?"))
    return;
  await chrome.runtime.sendMessage({ type: "forget" });
  document.getElementById("config").reset();
  status.textContent =
    "Configuration effacée. Révoque aussi la clé depuis Mentora si nécessaire.";
};
