const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
document.getElementById("logoImg").src = CONFIG.logoPath;

let currentUser = null;

async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = data.session.user;
  await ensureProfile();
  loadProfileForm();
  loadMyMedicines();
  loadNotifications();
}

async function ensureProfile() {
  const { data } = await sb.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  if (!data) {
    await sb.from("profiles").insert({
      id: currentUser.id,
      display_name: currentUser.email.split("@")[0],
      messenger_username: ""
    });
  }
}

document.getElementById("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  window.location.href = "login.html";
};

// ---------- TABS ----------
document.querySelectorAll(".tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ["medicines", "notifications", "profile"].forEach(name => {
      document.getElementById("tab-" + name).style.display = (name === btn.dataset.tab) ? "block" : "none";
    });
  });
});

// ---------- PROFILE ----------
async function loadProfileForm() {
  const { data } = await sb.from("profiles").select("*").eq("id", currentUser.id).single();
  if (data) {
    document.getElementById("displayName").value = data.display_name || "";
    document.getElementById("messengerUsername").value = data.messenger_username || "";
  }
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("profileStatus");
  statusEl.textContent = "Enregistrement...";
  try {
    const updates = {
      display_name: document.getElementById("displayName").value.trim(),
      messenger_username: document.getElementById("messengerUsername").value.trim()
    };
    const file = document.getElementById("avatarInput").files[0];
    if (file) {
      const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, file);
      if (upErr) throw upErr;
      updates.avatar_url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await sb.from("profiles").update(updates).eq("id", currentUser.id);
    if (error) throw error;
    statusEl.style.color = "#1f6f52";
    statusEl.textContent = "Profil mis à jour !";
  } catch (err) {
    statusEl.style.color = "#b5432a";
    statusEl.textContent = "Erreur : " + err.message;
  }
});

// ---------- ADD / EDIT MEDICINE ----------
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("status");
  const editId = document.getElementById("editId").value;
  const photoFile = document.getElementById("photoInput").files[0];

  if (!editId && !photoFile) {
    statusEl.textContent = "Veuillez ajouter une photo.";
    return;
  }

  statusEl.textContent = "Envoi en cours...";
  try {
    const fields = {
      name_fr: document.getElementById("name_fr").value.trim(),
      name_ar: document.getElementById("name_ar").value.trim(),
      name_en: document.getElementById("name_en").value.trim(),
      description_fr: document.getElementById("description_fr").value.trim(),
      description_ar: document.getElementById("description_ar").value.trim(),
      description_en: document.getElementById("description_en").value.trim(),
      comment: document.getElementById("comment").value.trim(),
      prescription_required: document.getElementById("prescriptionRequired").checked
    };

    if (photoFile) {
      const path = `${currentUser.id}/${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
      const { error: upErr } = await sb.storage.from("medicine-photos").upload(path, photoFile);
      if (upErr) throw upErr;
      fields.photo_url = sb.storage.from("medicine-photos").getPublicUrl(path).data.publicUrl;
    }

    if (editId) {
      const { error } = await sb.from("medicines").update(fields).eq("id", editId);
      if (error) throw error;
      statusEl.textContent = "Médicament modifié !";
    } else {
      fields.admin_id = currentUser.id;
      fields.status = "available";
      const { error } = await sb.from("medicines").insert(fields);
      if (error) throw error;
      statusEl.textContent = "Publié !";
    }

    resetForm();
    loadMyMedicines();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur : " + err.message;
  }
});

function resetForm() {
  document.getElementById("addForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("formTitle").textContent = "Ajouter un médicament";
  document.getElementById("submitBtn").textContent = "Publier ce médicament";
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("photoInput").required = false;
}

document.getElementById("cancelEditBtn").onclick = resetForm;

function fillFormForEdit(m) {
  document.getElementById("editId").value = m.id;
  document.getElementById("name_fr").value = m.name_fr || "";
  document.getElementById("name_ar").value = m.name_ar || "";
  document.getElementById("name_en").value = m.name_en || "";
  document.getElementById("description_fr").value = m.description_fr || "";
  document.getElementById("description_ar").value = m.description_ar || "";
  document.getElementById("description_en").value = m.description_en || "";
  document.getElementById("comment").value = m.comment || "";
  document.getElementById("prescriptionRequired").checked = m.prescription_required;
  document.getElementById("formTitle").textContent = "Modifier ce médicament";
  document.getElementById("submitBtn").textContent = "Enregistrer les modifications";
  document.getElementById("cancelEditBtn").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- MY MEDICINES LIST ----------
const STATUS_LABEL = { available: "Disponible", pending_review: "En attente de vérification", given: "Donné" };

async function loadMyMedicines() {
  const listEl = document.getElementById("myList");
  listEl.textContent = "Chargement...";
  const { data, error } = await sb
    .from("medicines")
    .select("*")
    .eq("admin_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) { listEl.textContent = "Erreur : " + error.message; return; }
  if (data.length === 0) { listEl.textContent = "Vous n'avez encore publié aucun médicament."; return; }

  listEl.innerHTML = "";
  data.forEach(m => {
    const row = document.createElement("div");
    row.className = "admin-item";
    row.innerHTML = `
      <img class="thumb" src="${m.photo_url}" alt="">
      <div class="info">
        <strong>${m.name_fr}</strong><br>
        <span class="status-pill status-${m.status}">${STATUS_LABEL[m.status] || m.status}</span>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Modifier";
    editBtn.style.background = "#e6e9e7";
    editBtn.onclick = () => fillFormForEdit(m);
    actions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Supprimer";
    delBtn.style.background = "#fbe4de";
    delBtn.style.color = "#b5432a";
    delBtn.onclick = async () => {
      if (!confirm("Supprimer définitivement ce médicament ?")) return;
      await sb.from("medicines").delete().eq("id", m.id);
      loadMyMedicines();
    };
    actions.appendChild(delBtn);

    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

// ---------- NOTIFICATIONS ----------
async function loadNotifications() {
  const listEl = document.getElementById("notifList");
  listEl.textContent = "Chargement...";
  const { data, error } = await sb
    .from("requests")
    .select("*, medicines(name_fr, photo_url)")
    .eq("admin_id", currentUser.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) { listEl.textContent = "Erreur : " + error.message; return; }

  document.getElementById("notifCount").textContent = data.length ? `(${data.length})` : "";

  if (data.length === 0) { listEl.textContent = "Aucune demande en attente."; return; }

  listEl.innerHTML = "";
  for (const reqRow of data) {
    const { data: signed } = await sb.storage.from("prescriptions").createSignedUrl(reqRow.prescription_path, 3600);
    const box = document.createElement("div");
    box.className = "panel notif-box";
    box.innerHTML = `
      <p><strong>Médicament :</strong> ${reqRow.medicines ? reqRow.medicines.name_fr : "(supprimé)"}</p>
      <p><strong>Référence à chercher sur Messenger :</strong> ${reqRow.id.slice(0,8)}</p>
      ${reqRow.requester_note ? `<p><strong>Message :</strong> ${reqRow.requester_note}</p>` : ""}
      <p><strong>Ordonnance envoyée :</strong></p>
      ${signed ? `<img class="prescription-preview" src="${signed.signedUrl}" alt="ordonnance">` : "<p>Impossible d'afficher l'image.</p>"}
      <p style="color:#8a6d1f; font-weight:bold; margin-top:10px;">⚠️ Vérifiez d'abord vos messages Messenger avant de valider.</p>
    `;
    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn-primary green";
    approveBtn.textContent = "Médicament donné (supprimer)";
    approveBtn.onclick = async () => {
      if (!confirm("Confirmer : ce médicament a bien été donné à cette personne ?")) return;
      await sb.from("requests").update({ status: "approved" }).eq("id", reqRow.id);
      await sb.from("medicines").delete().eq("id", reqRow.medicine_id);
      loadNotifications();
      loadMyMedicines();
    };

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn-primary danger";
    rejectBtn.textContent = "Refuser (remettre en ligne)";
    rejectBtn.onclick = async () => {
      await sb.from("requests").update({ status: "rejected" }).eq("id", reqRow.id);
      await sb.from("medicines").update({ status: "available" }).eq("id", reqRow.medicine_id);
      loadNotifications();
      loadMyMedicines();
    };

    actions.appendChild(rejectBtn);
    actions.appendChild(approveBtn);
    box.appendChild(actions);
    listEl.appendChild(box);
  }
}

requireAuth();
