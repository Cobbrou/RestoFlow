import { uid } from "../data/seed.js";
import { getSocket } from "../services/socket.js";

/**
 * Actions du back-office (Gestion) : configuration, clôture Z, tables, catalogue, équipe, stocks.
 * Persistées côté serveur (ManagementGateway) : mise à jour optimiste, puis liste diffusée par le serveur.
 * Les clés renvoyées sont celles attendues par le contexte RestoFlow.
 */
export function useManagementActions(store, { emit, pushToast, currentStaff }) {
  const { orders, setTables, setProducts, setIngredients, setRecipes, setStockMovements, setMenus, setStaff, setRoles, setConfig } = store;

  const handleUpdateConfig = (newConfig) => {
    setConfig(newConfig);
    emit("config:update", newConfig);
    pushToast("Configuration de la caisse mise à jour", "server");
  };

  const handleUpdateModules = (newModules) => {
    setConfig((prev) => ({
      ...prev,
      modulesConfig: newModules,
    }));
    emit("config:update_modules", { modules: newModules });
    pushToast("Configuration des modules mise à jour", "server");
  };

  const handleProcessZ = (payload) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("closing:process_z", payload, (res) => {
          if (res && res.ok) {
            pushToast(`✅ Clôture ${res.closing?.reportNumber || "Z"} validée avec succès`, "server");
            resolve(res);
          } else {
            pushToast(`❌ Erreur lors du Z : ${res?.error || "Inconnue"}`, "warn");
            reject(new Error(res?.error || "Erreur Z"));
          }
        });
      } else {
        pushToast("Clôture Z impossible hors-ligne : reconnectez la caisse au serveur", "warn");
        reject(new Error("offline"));
      }
    });
  };

  // ── Actions Gestion : tables ───────────────────────────────
  const tableHasActiveOrder = (tableId) => orders.some((o) => o.tableId === tableId);
  const addTable = (data) => {
    const id = uid("tbl");
    setTables((prev) => [...prev, { id, reserved: false, alert: false, x: 50, y: 50, ...data }]);
    emit("table:create", { id, ...data });
  };
  const updateTable = (id, data) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    emit("table:update", { id, data });
  };
  const deleteTable = (id) => {
    if (tableHasActiveOrder(id)) { pushToast("Impossible de supprimer : commande en cours", "warn"); return false; }
    setTables((prev) => prev.filter((t) => t.id !== id));
    emit("table:delete", { id });
    return true;
  };

  // ── Actions Gestion : produits ─────────────────────────────
  const addProduct = (data) => {
    if (data.directStock) {
      const prodId = data.id || uid("prod");
      const ingId = uid("ing");
      const rcId = uid("rc");
      const initialStock = Number(data.initialStock) || 0;
      const minThreshold = Number(data.minThreshold) || 5;
      const costPerUnit = Number(data.costPerUnit) || 0;
      const ingCategory = ["boissons", "bieres", "vins", "cafes"].includes(data.cat) ? "Boissons" : "Épicerie";

      const newProduct = {
        id: prodId,
        allergens: [],
        ...data,
        available: initialStock > 0 ? (data.available !== undefined ? data.available : true) : false,
      };

      const newIngredient = {
        id: ingId,
        name: data.name,
        category: ingCategory,
        unit: "piece",
        currentStock: initialStock,
        minThreshold,
        idealStock: Math.max(20, initialStock * 1.5),
        costPerUnit,
        supplier: null,
      };

      const newRecipe = {
        id: rcId,
        productId: prodId,
        ingredientId: ingId,
        ingredientName: data.name,
        quantity: 1,
        unit: "piece",
        costPerUnit,
        currentStock: initialStock,
        isCritical: true,
        notes: "Suivi de stock direct unitaire",
      };

      setProducts((prev) => [...prev, newProduct]);
      setIngredients((prev) => [...prev, newIngredient]);
      setRecipes((prev) => [...prev, newRecipe]);

      if (initialStock > 0) {
        setStockMovements((prev) => [
          {
            id: uid("mov"),
            ingredientId: ingId,
            ingredientName: data.name,
            category: ingCategory,
            unit: "piece",
            type: "DELIVERY",
            quantity: initialStock,
            unitCost: costPerUnit,
            reason: `Stock initial lors de la création du produit "${data.name}"`,
            createdAt: Date.now(),
          },
          ...prev,
        ]);
      }

      emit("catalog:create_product_with_stock", { ...data, id: prodId });
      pushToast(`Produit "${data.name}" créé avec ${initialStock} en stock`, "server");
    } else {
      const newProduct = { id: data.id || uid("prod"), allergens: [], ...data };
      setProducts((prev) => [...prev, newProduct]);
      emit("catalog:create_product", newProduct);
      pushToast(`Produit "${data.name}" créé`, "server");
    }
  };

  // Import CSV de la carte : un seul rafraîchissement local et un seul toast, une création serveur par produit
  const importProducts = (list) => {
    const created = list.map((p) => ({ id: uid("prod"), ...p }));
    setProducts((prev) => [...prev, ...created]);
    created.forEach((p) => emit("catalog:create_product", p));
    pushToast(`${created.length} produit${created.length > 1 ? "s" : ""} importé${created.length > 1 ? "s" : ""}`, "server");
  };

  const updateProduct = (id, data) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    emit("catalog:update_product", { id, ...data });
    pushToast("Produit mis à jour", "server");
  };

  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setRecipes((prev) => prev.filter((r) => r.productId !== id));
    emit("catalog:delete_product", { id });
    pushToast("Produit supprimé", "server");
  };

  // ── Actions Gestion : menus ────────────────────────────────
  const addMenu = (data) => {
    const id = uid("menu");
    setMenus((prev) => [...prev, { id, groups: [], ...data }]);
    emit("menu:create", { id, ...data });
  };
  const updateMenu = (id, data) => {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    emit("menu:update", { id, data });
  };
  const deleteMenu = (id) => {
    setMenus((prev) => prev.filter((m) => m.id !== id));
    emit("menu:delete", { id });
  };

  // ── Actions Gestion : équipe & rôles ────────────────────────
  // Le PIN part au serveur (haché en bcrypt) mais n'est jamais conservé dans l'état local
  const addStaff = (data) => {
    const id = uid("stf");
    const { pin: _pin, ...publicData } = data;
    setStaff((prev) => [...prev, { id, ...publicData }]);
    emit("staff:create", { id, ...data });
  };
  const updateStaff = (id, data) => {
    const { pin: _pin, ...publicData } = data;
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...publicData } : s)));
    emit("staff:update", { id, data });
  };
  const deleteStaff = (id) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    emit("staff:delete", { id });
  };

  const addRole = (data) => {
    const id = uid("role");
    setRoles((prev) => [...prev, { id, isSystem: false, ...data }]);
    emit("role:create", { id, ...data });
  };
  const updateRole = (id, data) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    emit("role:update", { id, data });
  };
  const deleteRole = (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    emit("role:delete", { id });
  };

  // ── Actions Gestion : stocks & fiches techniques (Phase 2) ──
  const handleAddStockMovement = (data) => {
    emit("stock:add_movement", { ...data, staffId: currentStaff?.id });
    pushToast("Mouvement de stock enregistré", "server");
  };

  const handleAddIngredient = (data) => {
    emit("stock:create_ingredient", data);
    pushToast(`Ingrédient créé : ${data.name}`, "server");
  };

  const handleUpdateIngredient = (id, data) => {
    emit("stock:update_ingredient", { id, ...data });
    pushToast("Ingrédient mis à jour", "server");
  };

  const handleDeleteIngredient = (id) => {
    emit("stock:delete_ingredient", { id });
    pushToast("Ingrédient archivé", "server");
  };

  const handleRestoreIngredient = (id) => {
    emit("stock:restore_ingredient", { id });
    pushToast("Ingrédient restauré", "server");
  };

  const handleSaveRecipe = (productId, items) => {
    emit("recipe:save", { productId, items });
    pushToast("Fiche technique enregistrée avec succès", "server");
  };

  const handleToggleProductAvailable = (productId) => {
    emit("catalog:toggle_product_available", { productId });
  };

  return {
    onUpdateConfig: handleUpdateConfig,
    onUpdateModules: handleUpdateModules,
    onProcessZ: handleProcessZ,
    onAddTable: addTable,
    onUpdateTable: updateTable,
    onDeleteTable: deleteTable,
    onAddProduct: addProduct,
    onImportProducts: importProducts,
    onUpdateProduct: updateProduct,
    onDeleteProduct: deleteProduct,
    onAddMenu: addMenu,
    onUpdateMenu: updateMenu,
    onDeleteMenu: deleteMenu,
    onAddStaff: addStaff,
    onUpdateStaff: updateStaff,
    onDeleteStaff: deleteStaff,
    onAddRole: addRole,
    onUpdateRole: updateRole,
    onDeleteRole: deleteRole,
    onAddMovement: handleAddStockMovement,
    onAddIngredient: handleAddIngredient,
    onUpdateIngredient: handleUpdateIngredient,
    onDeleteIngredient: handleDeleteIngredient,
    onRestoreIngredient: handleRestoreIngredient,
    onSaveRecipe: handleSaveRecipe,
    onToggleProductAvailable: handleToggleProductAvailable,
  };
}
