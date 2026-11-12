const BASE = "kangu_test_appareils";
const MAGASIN = "outbox_fictif";
const CLE_PREMIERE_ECRITURE = "kangu_test_premiere_ecriture";
const CIBLE = 50;

const journalEl = document.getElementById("journal");
const lignesJournal = [];

function journal(texte) {
  const heure = new Date().toLocaleString("fr-FR");
  const ligne = `[${heure}] ${texte}`;
  lignesJournal.push(ligne);
  const p = document.createElement("div");
  p.textContent = ligne;
  journalEl.prepend(p);
}

function afficherAppareil() {
  document.getElementById("appareil").textContent =
    `${navigator.userAgent} — écran ${screen.width}×${screen.height}`;
}

function ouvrirBase() {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore(MAGASIN, { keyPath: "id" });
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function compterEntrees() {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const requete = base.transaction(MAGASIN, "readonly").objectStore(MAGASIN).count();
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function ecrire50() {
  const base = await ouvrirBase();
  const transaction = base.transaction(MAGASIN, "readwrite");
  const magasin = transaction.objectStore(MAGASIN);
  // id = numéro fixe (1 à 50) : un nouveau clic réécrit les mêmes 50 clés au lieu d'en ajouter 50 autres.
  for (let i = 1; i <= CIBLE; i++) {
    magasin.put({
      id: i,
      numero: i,
      factice: true,
      creeLe: new Date().toISOString(),
    });
  }
  await new Promise((resoudre, rejeter) => {
    transaction.oncomplete = resoudre;
    transaction.onerror = () => rejeter(transaction.error);
  });
  if (!localStorage.getItem(CLE_PREMIERE_ECRITURE)) {
    localStorage.setItem(CLE_PREMIERE_ECRITURE, new Date().toISOString());
  }
  const total = await compterEntrees();
  journal(`Écriture terminée : ${total}/${CIBLE} entrées dans IndexedDB.`);
  document.getElementById("resultat-ecriture").textContent = `${total}/${CIBLE}`;
}

async function verifierPresence(libelleBouton) {
  const total = await compterEntrees();
  const ok = total === CIBLE;
  journal(`${libelleBouton} : ${total}/${CIBLE} entrées présentes${ok ? "" : " — PERTE DÉTECTÉE"}.`);
  return total;
}

async function mesurerStockage() {
  if (!navigator.storage?.estimate) {
    journal("navigator.storage.estimate indisponible sur ce navigateur.");
    document.getElementById("resultat-stockage").textContent = "indisponible";
    return;
  }
  const { usage, quota } = await navigator.storage.estimate();
  const versMo = (o) => (o / (1024 * 1024)).toFixed(2);
  const texte = `usage ${versMo(usage)} Mo / quota ${versMo(quota)} Mo`;
  document.getElementById("resultat-stockage").textContent = texte;
  journal(`Stockage : ${texte}.`);
}

async function demanderPersistance() {
  if (!navigator.storage?.persist) {
    journal("navigator.storage.persist indisponible sur ce navigateur.");
    document.getElementById("resultat-persistance").textContent = "indisponible";
    return;
  }
  const accorde = await navigator.storage.persist();
  const dejaAccorde = await navigator.storage.persisted?.();
  const texte = accorde ? "ACCORDÉ" : "REFUSÉ";
  document.getElementById("resultat-persistance").textContent =
    `${texte} (persisted() = ${dejaAccorde})`;
  journal(`Stockage persistant demandé : ${texte}.`);
}

function afficherMesureReseau() {
  const [entree] = performance.getEntriesByType("navigation");
  if (!entree) {
    document.getElementById("resultat-reseau").textContent = "indisponible";
    return;
  }
  const reseauSeul = Math.round(entree.responseEnd - entree.requestStart);
  const total = Math.round(entree.loadEventEnd - entree.startTime);
  const texte = `réseau seul : ${reseauSeul} ms — total (DOM + réseau) : ${total} ms`;
  document.getElementById("resultat-reseau").textContent = texte;
  journal(`Mesure de ce chargement : ${texte}.`);
}

async function verifierApres2a3Jours() {
  const premiere = localStorage.getItem(CLE_PREMIERE_ECRITURE);
  if (!premiere) {
    journal("Aucune première écriture enregistrée : faites d'abord l'étape « Écrire 50 opérations ».");
    return;
  }
  const jours = (Date.now() - new Date(premiere).getTime()) / 86_400_000;
  const total = await verifierPresence("Vérification différée");
  document.getElementById("resultat-differe").textContent =
    `${total}/${CIBLE} entrées, ${jours.toFixed(1)} jour(s) après la première écriture (le ${new Date(premiere).toLocaleString("fr-FR")}).`;
}

async function copierJournal() {
  const texte = lignesJournal.slice().reverse().join("\n");
  await navigator.clipboard.writeText(texte);
  journal("Journal copié dans le presse-papiers.");
}

async function initialiser() {
  afficherAppareil();
  // loadEventEnd n'est renseigné qu'après la fin de l'événement load : on attend donc
  // cet événement, puis un court délai, avant de mesurer.
  const mesurerApresChargement = () => setTimeout(afficherMesureReseau, 300);
  if (document.readyState === "complete") {
    mesurerApresChargement();
  } else {
    globalThis.addEventListener("load", mesurerApresChargement, { once: true });
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
      journal("Service worker enregistré.");
    } catch (erreur) {
      journal(`Échec d'enregistrement du service worker : ${erreur.message}`);
    }
  } else {
    journal("Service worker non supporté par ce navigateur.");
  }

  document.getElementById("installee").textContent =
    globalThis.matchMedia("(display-mode: standalone)").matches ? "Oui (mode autonome détecté)" : "Non (ouverte dans un onglet du navigateur)";

  const total = await compterEntrees().catch(() => 0);
  if (total > 0) {
    document.getElementById("resultat-ecriture").textContent = `${total}/${CIBLE}`;
  }

  document.getElementById("bouton-ecrire").addEventListener("click", ecrire50);
  document.getElementById("bouton-stockage").addEventListener("click", mesurerStockage);
  document.getElementById("bouton-persistance").addEventListener("click", demanderPersistance);
  document.getElementById("bouton-verifier-coupure").addEventListener(
    "click",
    () => verifierPresence("Vérification après coupure"),
  );
  document.getElementById("bouton-verifier-differe").addEventListener("click", verifierApres2a3Jours);
  document.getElementById("bouton-copier-journal").addEventListener("click", copierJournal);
}

initialiser();
