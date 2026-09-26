/**
 * Helper de vérification des permissions et du contrôle d'accès RBAC de RestoFlow.
 */

export function hasPermission(staff, roleObj, permissionId) {
  if (!staff) return false;
  if (staff.roleId === "admin") return true;
  const permissions = roleObj?.permissions || staff.role?.permissions || [];
  return permissions.includes(permissionId);
}

export function canAccessTab(staff, roleObj, tabId) {
  if (!staff) return false;
  if (staff.roleId === "admin") return true;
  const permissions = roleObj?.permissions || staff.role?.permissions || [];

  switch (tabId) {
    case "serveur":
      // Accès au plan de salle et prise de commande
      return permissions.some((p) => p.startsWith("salle."));
    case "cuisine":
      // Accès au KDS cuisine
      return permissions.includes("cuisine.view");
    case "dashboard":
      // Accès au tableau de bord / KPIs
      return permissions.includes("dashboard.view");
    case "gestion":
      // Accès au back-office (tables, produits, menus, stocks, équipe, historique ou clôtures caisse)
      return permissions.some((p) => p.startsWith("gestion.") || p.startsWith("caisse."));
    default:
      return false;
  }
}

export function getDefaultTabForStaff(staff, roleObj) {
  if (!staff) return "serveur";
  if (staff.roleId === "admin") return "serveur";

  const permissions = roleObj?.permissions || staff.role?.permissions || [];

  // Le cuisinier arrive par défaut en cuisine
  if (permissions.includes("cuisine.view") && !permissions.some((p) => p.startsWith("salle."))) {
    return "cuisine";
  }

  // Le serveur ou responsable de salle arrive en salle
  if (permissions.some((p) => p.startsWith("salle."))) {
    return "serveur";
  }

  // Le comptable arrive sur le dashboard
  if (permissions.includes("dashboard.view")) {
    return "dashboard";
  }

  // Gestion
  if (permissions.some((p) => p.startsWith("gestion."))) {
    return "gestion";
  }

  return "serveur";
}

export function getRoleName(staff, roles = []) {
  if (!staff) return "";
  const roleObj = roles.find((r) => r.id === staff.roleId) || staff.role;
  if (roleObj?.name) return roleObj.name;

  switch (staff.roleId) {
    case "admin":
      return "Administrateur";
    case "cook":
      return "Chef de cuisine";
    case "head_waiter":
      return "Responsable de salle";
    case "server":
      return "Serveur / Serveuse";
    case "accountant":
      return "Comptable";
    default:
      return staff.roleId || "Utilisateur";
  }
}
