/**
 * Le FEC est généré par le serveur (closing:get_fec) sur l'historique complet.
 * Ce module ne fait que proposer le fichier au téléchargement.
 */

/**
 * Télécharge un fichier texte (ex: FEC) dans le navigateur
 */
export function triggerFileDownload(content, fileName = "FEC.txt") {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
