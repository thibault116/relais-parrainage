const status = document.getElementById("status");
async function update() {
  const s = await chrome.runtime.sendMessage({ type: "status" });
  status.textContent = `${s.enabled ? "Active" : "En pause"} — ${s.message}${s.lastSync ? " · Dernier contact : " + new Date(s.lastSync).toLocaleString() : ""}`;
}
for (const type of ["start", "pause"])
  document.getElementById(type).onclick = async () => {
    try {
      const r = await chrome.runtime.sendMessage({ type });
      if (r.error) throw Error(r.error);
      await update();
    } catch (e) {
      status.textContent = e.message;
    }
  };
document.getElementById("options").onclick = () =>
  chrome.runtime.openOptionsPage();
void update();
