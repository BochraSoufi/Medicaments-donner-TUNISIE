const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

const TEXT = {
  fr: {
    dir: "ltr",
    intro: "Voici les médicaments actuellement disponibles, donnés par des familles. Certains nécessitent une ordonnance : dans ce cas, envoyez-nous la photo de l'ordonnance avant de contacter l'admin sur Messenger.",
    footer: "Projet associatif — géré par des bénévoles.",
    needBtnFree: "J'en ai besoin — Contacter sur Messenger",
    needBtnRx: "Envoyer mon ordonnance",
    prescriptionRequired: "Ordonnance requise",
    noPrescription: "Sans ordonnance",
    empty: "Aucun médicament disponible pour le moment. Revenez bientôt.",
    postedBy: "Publié par",
    modalTitle: "Envoyer votre ordonnance",
    modalDesc: "Ce médicament nécessite une ordonnance du médecin. Prenez-en une photo claire et envoyez-la ci-dessous. Un admin va la vérifier.",
    noteLabel: "Message pour l'admin (optionnel)",
    send: "Envoyer",
    cancel: "Annuler",
    sending: "Envoi en cours...",
    doneTitle: "Ordonnance envoyée !",
    doneDesc: "Votre référence est :",
    doneNext: "Cliquez ci-dessous pour contacter l'admin sur Messenger et mentionnez cette référence.",
    openMessenger: "Ouvrir Messenger",
    close: "Fermer"
  },
  ar: {
    dir: "rtl",
    intro: "هذه هي الأدوية المتوفرة حاليًا، والتي تبرعت بها بعض العائلات. بعضها يتطلب وصفة طبية: في هذه الحالة أرسلوا لنا صورة الوصفة قبل التواصل مع المسؤول عبر ماسنجر.",
    footer: "مشروع تطوعي — يديره متطوعون.",
    needBtnFree: "أحتاج إليه — تواصل عبر ماسنجر",
    needBtnRx: "أرسل وصفتي الطبية",
    prescriptionRequired: "يتطلب وصفة طبية",
    noPrescription: "بدون وصفة",
    empty: "لا توجد أدوية متاحة حاليًا. عودوا قريبًا.",
    postedBy: "نشرها",
    modalTitle: "أرسل وصفتك الطبية",
    modalDesc: "هذا الدواء يتطلب وصفة طبية. التقط صورة واضحة وأرسلها أدناه. سيتحقق منها أحد المسؤولين.",
    noteLabel: "رسالة للمسؤول (اختياري)",
    send: "إرسال",
    cancel: "إلغاء",
    sending: "جارٍ الإرسال...",
    doneTitle: "تم إرسال الوصفة!",
    doneDesc: "رقم مرجعك هو:",
    doneNext: "اضغط أدناه للتواصل مع المسؤول عبر ماسنجر واذكر هذا الرقم المرجعي.",
    openMessenger: "فتح ماسنجر",
    close: "إغلاق"
  },
  en: {
    dir: "ltr",
    intro: "These are the medicines currently available, donated by families. Some require a prescription: in that case, send us a photo of it before contacting the admin on Messenger.",
    footer: "Volunteer-run charity project.",
    needBtnFree: "I need this — Contact on Messenger",
    needBtnRx: "Send my prescription",
    prescriptionRequired: "Prescription required",
    noPrescription: "No prescription needed",
    empty: "No medicines available right now. Please check back soon.",
    postedBy: "Posted by",
    modalTitle: "Send your prescription",
    modalDesc: "This medicine requires a doctor's prescription. Take a clear photo and send it below. An admin will review it.",
    noteLabel: "Message for the admin (optional)",
    send: "Send",
    cancel: "Cancel",
    sending: "Sending...",
    doneTitle: "Prescription sent!",
    doneDesc: "Your reference is:",
    doneNext: "Click below to contact the admin on Messenger and mention this reference.",
    openMessenger: "Open Messenger",
    close: "Close"
  }
};

let currentLang = "fr";
let medicines = [];

document.getElementById("logoImg").src = CONFIG.logoPath;

function buildMessengerLink(text) {
  return `https://m.me/${CONFIG.facebookPageUsername}?text=${encodeURIComponent(text)}`;
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function openPrescriptionModal(medicine) {
  const t = TEXT[currentLang];
  const name = medicine["name_" + currentLang] || medicine.name_fr;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal-box">
        <h3>${t.modalTitle}</h3>
        <p>${t.modalDesc}</p>
        <p><strong>${name}</strong></p>
        <input type="file" id="rxFile" accept="image/*" capture="environment">
        <textarea id="rxNote" rows="2" placeholder="${t.noteLabel}"></textarea>
        <div class="modal-actions">
          <button class="btn-primary btn-secondary" id="rxCancel">${t.cancel}</button>
          <button class="btn-primary green" id="rxSend">${t.send}</button>
        </div>
        <p id="rxStatus"></p>
      </div>
    </div>
  `;
  document.getElementById("rxCancel").onclick = closeModal;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("rxSend").onclick = async () => {
    const file = document.getElementById("rxFile").files[0];
    const note = document.getElementById("rxNote").value.trim();
    const statusEl = document.getElementById("rxStatus");
    if (!file) { statusEl.textContent = "..."; return; }
    statusEl.textContent = t.sending;
    try {
      const path = `${medicine.admin_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
      const { error: upErr } = await sb.storage.from("prescriptions").upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await sb.from("requests").insert({
        medicine_id: medicine.id,
        admin_id: medicine.admin_id,
        prescription_path: path,
        requester_note: note
      }).select().single();
      if (error) throw error;

      const ref = data.id.slice(0, 8);
      const msgText = `${name} — ref:${ref}`;
      document.getElementById("modalRoot").innerHTML = `
        <div class="modal-overlay" id="overlay2">
          <div class="modal-box">
            <h3>${t.doneTitle}</h3>
            <p>${t.doneDesc} <strong>${ref}</strong></p>
            <p>${t.doneNext}</p>
            <a class="btn-msg" href="${buildMessengerLink(msgText)}" target="_blank" rel="noopener">${t.openMessenger}</a>
            <div class="modal-actions">
              <button class="btn-primary btn-secondary" id="closeDone">${t.close}</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById("closeDone").onclick = () => { closeModal(); loadMedicines(); };
      document.getElementById("overlay2").onclick = (e) => { if (e.target.id === "overlay2") { closeModal(); loadMedicines(); } };
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Erreur: " + err.message;
    }
  };
}

function render() {
  const t = TEXT[currentLang];
  document.documentElement.lang = currentLang;
  document.documentElement.dir = t.dir;
  document.getElementById("introText").textContent = t.intro;
  document.getElementById("footerText").textContent = t.footer;
  document.getElementById("siteTitle").textContent = CONFIG.siteName[currentLang];

  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");
  grid.innerHTML = "";

  if (medicines.length === 0) {
    emptyState.style.display = "block";
    emptyState.textContent = t.empty;
    return;
  }
  emptyState.style.display = "none";

  medicines.forEach(m => {
    const name = m["name_" + currentLang] || m.name_fr;
    const desc = m["description_" + currentLang] || m.description_fr;
    const profile = m.profiles || {};

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img class="photo" src="${m.photo_url}" alt="${name}">
      <div class="card-body">
        <div class="poster">
          <img src="${profile.avatar_url || 'images/logo.svg'}" alt="">
          <span>${t.postedBy} ${profile.display_name || ""}</span>
        </div>
        <h2>${name}</h2>
        ${desc ? `<p>${desc}</p>` : ""}
        ${m.comment ? `<p class="comment">"${m.comment}"</p>` : ""}
        <span class="badge ${m.prescription_required ? "required" : "free"}">
          ${m.prescription_required ? t.prescriptionRequired : t.noPrescription}
        </span>
      </div>
    `;

    const btn = document.createElement(m.prescription_required ? "button" : "a");
    btn.className = "btn-msg";
    if (m.prescription_required) {
      btn.textContent = t.needBtnRx;
      btn.onclick = () => openPrescriptionModal(m);
    } else {
      btn.textContent = t.needBtnFree;
      btn.href = buildMessengerLink(name);
      btn.target = "_blank";
      btn.rel = "noopener";
    }
    card.querySelector(".card-body").appendChild(btn);
    grid.appendChild(card);
  });
}

async function loadMedicines() {
  const { data, error } = await sb
    .from("medicines")
    .select("*, profiles(display_name, avatar_url)")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("emptyState").style.display = "block";
    document.getElementById("emptyState").textContent = "Erreur de chargement / Loading error.";
    return;
  }
  medicines = data;
  render();
}

document.querySelectorAll(".lang-switch button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lang-switch button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentLang = btn.dataset.lang;
    render();
  });
});

loadMedicines();
