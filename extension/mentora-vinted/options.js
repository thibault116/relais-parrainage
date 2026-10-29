const status = document.getElementById("status");
const tokenInput = document.getElementById("token");
const form = document.getElementById("config");
const submit = form.querySelector('button');
async function request(message) {
  const r = await chrome.runtime.sendMessage(message);
  if (!r || r.ignored || r.error) throw Error(r?.error || "L’extension n’a pas confirmé l’action. Recharge-la dans la page des extensions, puis rouvre Configurer.");
  return r;
}
function keyState(hasToken) {
  tokenInput.required = !hasToken;
  tokenInput.placeholder = hasToken ? "Clé enregistrée — laisse vide pour la conserver" : "Colle ta clé de connexion Mentora";
  document.getElementById("key-state").textContent = hasToken ? "✓ Clé enregistrée sur cet ordinateur. Elle est masquée pour rester privée." : "Aucune clé enregistrée sur cet ordinateur.";
}
async function load() {
  const s = await request({type:"status"});
  keyState(s.hasToken);
  document.getElementById("ordersUrl").value = s.ordersUrl;
  document.getElementById("accountKey").value = s.accountKey;
}
submit.disabled = true;
load().catch(e => { status.textContent=e.message; }).finally(() => {submit.disabled=false;});
form.onsubmit = async e => {
  e.preventDefault(); submit.disabled=true;
  try {
    const r = await request({type:"configure",token:tokenInput.value.trim(),ordersUrl:document.getElementById("ordersUrl").value.trim(),accountKey:document.getElementById("accountKey").value.trim()});
    if (r.ok !== true || r.hasToken !== true) throw Error("La sauvegarde n’a pas été confirmée. Ta clé reste dans le champ : réessaie.");
    const stored=await request({type:"status"});
    if(!stored.hasToken)throw Error("La clé n’est pas enregistrée. Réessaie.");
    tokenInput.value=""; keyState(true);
    status.textContent="Configuration et clé enregistrées. Ouvre l’icône Mentora puis clique sur Démarrer. Tu n’as pas besoin de recoller la clé.";
  } catch(e) {status.textContent=e.message;} finally {submit.disabled=false;}
};
document.getElementById("forget").onclick = async () => {
  if(!confirm("Effacer la clé de cet ordinateur et arrêter la lecture ?"))return;
  try {const r=await request({type:"forget"});if(!r.ok)throw Error("Effacement non confirmé.");form.reset();keyState(false);status.textContent="Configuration effacée. Révoque aussi la clé depuis Mentora si nécessaire.";}catch(e){status.textContent=e.message;}
};
