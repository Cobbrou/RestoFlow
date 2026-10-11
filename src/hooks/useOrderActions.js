import { useCallback } from "react";
import { uid } from "../data/seed.js";
import { getProductEffectivePrice, resolveOptions, resolveMenuOptions, heldToRelease, isOffPremise, orderLabel } from "../utils/index.js";
import { getSocket } from "../services/socket.js";
import { menuVatSplit } from "../utils/vat.js";

/**
 * Actions de service : prise de commande, encaissement, cuisine, suites, transfert / fusion de tables
 * et réservations. Mise à jour optimiste de l'état local, puis émission (ou mise en file hors-ligne).
 */
export function useOrderActions(store, {
  emit, pushToast, beep, soundOn, currentStaff, activeTableId, setActiveTableId, setServerView,
}) {
  const { tables, setTables, orders, setOrders, reservations, setReservations, setHistory, config } = store;

  const getActiveOrder = useCallback(
    (tableId) => orders.find((o) => o.tableId === tableId),
    [orders]
  );

  const updateOrder = (orderId, fn) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? fn(o) : o)));
  };

  const ensureOrderForTable = useCallback(
    (tableId, overrideStaff = null, covers = null) => {
      let order = getActiveOrder(tableId);
      if (!order) {
        const staffObj = overrideStaff || currentStaff;
        const serverName = staffObj ? staffObj.name.split(" ")[0] : "Service";
        order = {
          id: uid("ord"),
          tableId,
          server: serverName,
          covers,
          createdAt: Date.now(),
          items: [],
        };
        setOrders((prev) => [...prev, order]);
        emit("order:create_or_ensure", { orderId: order.id, tableId, server: serverName, covers });
      }
      return order;
    },
    [getActiveOrder, currentStaff]
  );

  /**
   * Commande hors salle (emporter) : créée localement puis par le serveur, qui attribue le numéro d'appel.
   * Même identifiant des deux côtés : le rejeu hors-ligne ne crée pas de doublon.
   */
  const createOffPremiseOrder = ({ type = "takeaway", channel = "pos", customerName = "", customerPhone = "", pickupAt = null }) => {
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : "Service";
    const order = {
      id: uid("ord"),
      tableId: null,
      type,
      channel,
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      pickupAt,
      pickupNumber: null,
      server: serverName,
      createdAt: Date.now(),
      items: [],
    };
    setOrders((prev) => [...prev, order]);
    emit("order:create_offpremise", { orderId: order.id, type, channel, server: serverName, customerName, customerPhone, pickupAt });
    return order;
  };

  const getItemCourseAndStation = (product, order) => {
    const cat = product?.cat || "";
    const isBar =
      cat === "boissons" ||
      product?.station === "bar";
    const station = isBar ? "bar" : (product?.station || "kitchen");
    let course = "plat";
    if (isBar) {
      course = "boisson";
    } else if (cat === "entrees") {
      course = "entree";
    } else if (cat === "desserts") {
      course = "dessert";
    } else {
      course = "plat";
    }
    let courseStatus = (course === "entree" || course === "boisson" || course === "direct") ? "direct" : "held";
    // Hors salle : tout part ensemble, pas de suites à réclamer
    if (isOffPremise(order)) course = courseStatus = "direct";
    return { course, courseStatus, station, cat };
  };

  // target : id de table, ou commande hors salle déjà créée (createOffPremiseOrder)
  const resolveTarget = (target) =>
    typeof target === "string" ? { order: ensureOrderForTable(target), tableId: target } : { order: target, tableId: undefined };

  // optionPicks : [{ group, choice }] (cuisson, suppléments), revalidés et facturés par le serveur
  const addProductToOrder = (target, product, optionPicks = []) => {
    const { order, tableId } = resolveTarget(target);
    const { course, courseStatus, station, cat } = getItemCourseAndStation(product, order);
    const { label: options, extra } = resolveOptions(product.options, optionPicks);
    const effectivePrice = Math.round((getProductEffectivePrice(product, config) + extra) * 100) / 100;
    const sameLine = (i) =>
      i.productId === product.id && i.status === "draft" && !i.notes && (i.options || "") === options &&
      (i.course || course) === course && i.price === effectivePrice;
    // Nouvelle ligne : son id est partagé avec le serveur (les actions hors-ligne suivantes le référencent)
    const lineId = uid("it");
    const mergesIntoExisting = order.items.some(sameLine);

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        const existing = o.items.find(sameLine);
        if (existing) {
          return { ...o, items: o.items.map((i) => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i) };
        }
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: lineId,
              productId: product.id,
              name: product.name,
              price: effectivePrice,
              vatRate: product.vatRate ?? 10,
              qty: 1,
              notes: "",
              options,
              status: "draft",
              course,
              courseStatus,
              station,
            },
          ],
        };
      })
    );

    emit("order:add_item", {
      orderId: order.id,
      tableId,
      itemId: mergesIntoExisting ? undefined : lineId,
      product: { id: product.id, name: product.name, price: effectivePrice, cat, station, isMenu: false },
      options: optionPicks,
      course,
      courseStatus,
      station,
      addedAt: Date.now(), // le serveur fixe le prix (Happy Hour) à l'heure de l'ajout, même rejoué hors-ligne
    });
  };

  const addComposedMenuToOrder = (target, menuProduct, composition) => {
    const { order, tableId } = resolveTarget(target);
    const course = isOffPremise(order) ? "direct" : "plat";
    const courseStatus = isOffPremise(order) ? "direct" : "held";
    const station = "kitchen";
    const lineId = uid("it");
    const { label: options, extra } = resolveMenuOptions(composition, store.products);
    // Même ventilation TVA que le serveur : taux unique des composants, ou répartition au prorata si mixte
    const components = (composition || [])
      .flatMap((g) => g?.productIds || [])
      .map((pid) => store.products.find((p) => p.id === pid))
      .filter(Boolean);
    const vatSplit = menuVatSplit(components);

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: lineId,
              productId: menuProduct.id,
              name: menuProduct.name,
              price: Math.round((menuProduct.price + extra) * 100) / 100,
              vatRate: vatSplit ? 10 : (components[0]?.vatRate ?? 10),
              vatSplit,
              qty: 1,
              notes: "",
              options,
              status: "draft",
              isMenu: true,
              composition,
              course,
              courseStatus,
              station,
            },
          ],
        };
      })
    );

    emit("order:add_item", {
      orderId: order.id,
      tableId,
      itemId: lineId,
      product: { id: menuProduct.id, name: menuProduct.name, price: menuProduct.price, cat: "menus", station: "kitchen", isMenu: true },
      composition,
      course,
      courseStatus,
      station,
      addedAt: Date.now(),
    });
  };

  const changeQty = (orderId, itemId, delta) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.flatMap((i) => {
        if (i.id !== itemId) return [i];
        const q = i.qty + delta;
        return q <= 0 ? [] : [{ ...i, qty: q }];
      }),
    }));

    emit("order:change_qty", { orderId, itemId, delta });
  };

  const removeItem = (orderId, itemId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.filter((i) => i.id !== itemId) }));
    emit("order:remove_item", { orderId, itemId });
  };

  // Annulation d'un article envoyé : jamais hors-ligne (droit vérifié, stock et journal NF525 côté serveur)
  const voidItem = (orderId, itemId, qty, reason, done) => {
    const socket = getSocket();
    if (!socket?.connected) {
      pushToast("Annulation impossible hors-ligne : reconnectez le terminal au serveur", "warn");
      done?.(false);
      return;
    }
    socket.emit("order:void_item", { orderId, itemId, qty, reason }, (res) => {
      if (res?.ok) {
        setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)));
        pushToast("Article annulé, cuisine prévenue", "server");
      } else {
        pushToast(res?.error || "Échec de l'annulation", "warn");
      }
      done?.(!!res?.ok);
    });
  };

  const setItemNote = (orderId, itemId, note) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, notes: note } : i)),
    }));
    emit("order:set_note", { orderId, itemId, note });
  };

  const sendToKitchen = (orderId) => {
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : "Service";
    const rawModules = config?.modulesConfig;
    const modules = (typeof rawModules === "string" ? JSON.parse(rawModules) : rawModules) || {};
    updateOrder(orderId, (o) => {
      const released = heldToRelease(o.items, modules.enableCoursePacing ?? true);
      return {
        ...o,
        sentAt: Date.now(),
        server: serverName,
        items: o.items.map((i) =>
          i.status === "draft" ? { ...i, status: "new", ...(released.includes(i.id) && { courseStatus: "direct" }) } : i
        ),
      };
    });
    setServerView("plan");
    emit("order:send_kitchen", { orderId, serverName });
  };

  const serveAndMaybeFree = (orderId, targetCourse = null) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if (i.status !== "ready") return i;
        if (targetCourse && i.course !== targetCourse) return i;
        return { ...i, status: "served" };
      }),
    }));
    emit("order:serve", { orderId, course: targetCourse });
  };

  const handleApplyDiscount = (orderId, discount) => {
    updateOrder(orderId, (o) => ({ ...o, discount }));
    emit("order:discount:apply", { orderId, discount });
  };

  const handleRemoveDiscount = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, discount: null }));
    emit("order:discount:remove", { orderId });
  };

  /**
   * Encaissement : archive dans l'historique, libère la table et synchronise.
   */
  const checkoutOrder = (orderId, paymentMethod, payments = null, meta = {}) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const table    = tables.find((t) => t.id === order.tableId);
    // Comptoir : les articles saisis sont vendus directement (le serveur les passe en "servi").
    // Note entamée par des tickets de convive : seul le reste figure sur ce ticket.
    const paidItems = (order.type === "counter"
      ? order.items.map((i) => (i.status === "draft" ? { ...i, status: "served" } : i))
      : order.items.filter((i) => i.status !== "draft")
    )
      .map((i) => ({ ...i, qty: i.qty - (i.paidQty || 0) }))
      .filter((i) => i.qty > 0);
    const subtotal = meta?.subtotal ?? paidItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const discount = meta?.discount ?? order.discount ?? null;
    const total = meta?.total ?? paidItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const vatDetails = meta?.vatDetails ?? null;
    const tpeData = meta?.tpeData ?? null;
    const paidAt   = Date.now();
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : order.server;

    const paymentList = payments && payments.length > 0 ? payments : [
      { id: uid("pay"), label: "Paiement unique", amount: total, method: paymentMethod, paidAt, tpeData },
    ];

    const finalMethod = paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    // Numéro provisoire : le numéro de facture définitif est attribué par le serveur (history:new_entry)
    const ticketNumber = `PROV-${order.id}`;

    const receipt = {
      id: uid("rcpt"),
      ticketNumber,
      orderId:       order.id,
      tableNumber:   table?.number,
      orderType:     order.type || "dine_in",
      orderLabel:    isOffPremise(order) ? orderLabel(order) : null,
      server:        serverName,
      items:         paidItems,
      subtotal,
      discount,
      vatDetails,
      tpeData,
      total,
      tip: Number(meta?.tip || 0),
      paymentMethod: finalMethod,
      payments:      paymentList,
      paidAt,
    };

    setHistory((prev) => [
      {
        id: uid("hist"),
        ticketNumber,
        createdAt: paidAt,
        server: serverName,
        items: paidItems,
        subtotal,
        discount,
        vatDetails,
        total,
        tip: Number(meta?.tip || 0),
        tableNumber: table?.number,
        orderType: order.type || "dine_in",
        orderLabel: isOffPremise(order) ? orderLabel(order) : null,
        paymentMethod: finalMethod,
        payments: paymentList,
        orderId: order.id,
      },
      ...prev,
    ]);

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setTables((prev) =>
      prev.map((t) =>
        t.id === order.tableId
          ? {
              ...t,
              alert: false,
              reserved: false,
              reservationName: "",
              reservationPeople: "",
              reservationTime: "",
              reservationNote: "",
            }
          : t
      )
    );

    // Montants, remise, TVA et numéro de ticket sont recalculés par le serveur
    emit("order:checkout", {
      orderId,
      paymentMethod: finalMethod,
      payments: paymentList,
      tip: Number(meta?.tip || 0),
      operatorId: currentStaff?.id,
    });

    return receipt;
  };

  /**
   * Ticket par convive : encaisse une partie des lignes sur un ticket séparé ; la note reste ouverte.
   * Montant et ticket définitifs calculés par le serveur (history:new_entry).
   */
  const partialCheckout = (orderId, lines, payments, amount) => {
    updateOrder(orderId, (o) => ({
      ...o,
      paidTotal: Math.round(((o.paidTotal || 0) + amount) * 100) / 100,
      items: o.items.map((i) => {
        const l = lines.find((x) => x.itemId === i.id);
        return l ? { ...i, paidQty: (i.paidQty || 0) + l.qty } : i;
      }),
    }));
    emit("order:checkout", {
      orderId,
      lines,
      payments,
      paymentMethod: payments.length === 1 ? payments[0].method : "partage",
      tip: 0,
      operatorId: currentStaff?.id,
    });
    pushToast(`Ticket émis : ${payments[0]?.label || "convive"} (${amount.toFixed(2)} €)`, "server");
  };

  const setOrderCovers = (orderId, covers) => {
    updateOrder(orderId, (o) => ({ ...o, covers }));
    emit("order:set_covers", { orderId, covers });
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, alert: !t.alert } : t)));
    emit("tables:toggle_alert", { tableId });
  };

  // ── Actions Cuisine (Phase 4 multi-postes) ──────────────────
  const startPrep = (orderId, station = "all") => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if (i.status !== "new") return i;
        if (i.courseStatus === "held") return i; // Ne pas démarrer les articles en attente de réclame
        if (station !== "all") {
          const isBar = i.station === "bar";
          if (station === "bar" && !isBar) return i;
          if (station === "kitchen" && isBar) return i;
        }
        return { ...i, status: "preparing" };
      }),
    }));
    emit("order:start_prep", { orderId, station });
  };

  const markReady = (orderId, station = "all") => {
    const current = orders.find((o) => o.id === orderId);
    const label = current ? orderLabel(current, tables) : null;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          items: o.items.map((i) => {
            if (i.status !== "preparing") return i;
            if (i.courseStatus === "held") return i; // Les articles en attente ne peuvent pas être prêts
            if (station !== "all") {
              const isBar = i.station === "bar";
              if (station === "bar" && !isBar) return i;
              if (station === "kitchen" && isBar) return i;
            }
            return { ...i, status: "ready" };
          }),
        };
      })
    );
    if (label) {
      const stationSuffix = station === "bar" ? " (Bar)" : station === "kitchen" ? " (Cuisine)" : "";
      pushToast(`🔔 Commande ${label} prête${stationSuffix}`, "server");
      if (soundOn) beep(980);
    }
    emit("order:mark_ready", { orderId, station });
  };

  // ── Actions Phase 4 : Suites & Réclame ──────────────────────
  const handleCallCourse = (orderId, course) => {
    const order = orders.find((o) => o.id === orderId);
    const table = tables.find((t) => t.id === order?.tableId);
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : order?.server || "Service";

    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if ((course === "suite" || i.course === course) && i.courseStatus === "held") {
          return { ...i, courseStatus: "called", status: "new" };
        }
        return i;
      }),
    }));

    emit("order:call_course", { orderId, course, serverName, server: serverName });
    const courseLabels = { entree: "Entrées", plat: "Plats", dessert: "Desserts", boisson: "Boissons", direct: "Direct", suite: "Suite" };
    pushToast(`🔔 Réclame transmise en cuisine pour Table ${table?.number || ""} : ${courseLabels[course] || course}`, "server");
    if (soundOn) beep(840);
  };

  const handleChangeItemCourse = (orderId, itemId, course) => {
    const defaultHeld = course === "plat" || course === "dessert";
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, course, courseStatus: defaultHeld ? "held" : "direct" } : i)),
    }));
    emit("order:change_item_course", { orderId, itemId, course });
  };

  // ── Actions Phase 4 : Transfert & Fusion de tables ─────────
  const handleTransferTable = (sourceTableId, targetTableId) => {
    const sourceT = tables.find((t) => t.id === sourceTableId);
    const targetT = tables.find((t) => t.id === targetTableId);

    // Snapshot pour rollback en cas de rejet serveur (Axe 3)
    const prevOrders = orders;
    const prevReservations = reservations;
    const prevActiveTableId = activeTableId;

    setOrders((prev) =>
      prev.map((o) => (o.tableId === sourceTableId ? { ...o, tableId: targetTableId } : o))
    );
    setReservations((prev) =>
      prev.map((r) => (r.tableId === sourceTableId ? { ...r, tableId: targetTableId } : r))
    );

    const socket = getSocket();
    if (!socket || !socket.connected) {
      pushToast(`↔️ Table ${sourceT?.number} transférée vers Table ${targetT?.number}`, "server");
    }

    emit(
      "tables:transfer",
      { sourceTableId, targetTableId, staffName: currentStaff?.name },
      (res) => {
        if (res && res.ok === false) {
          // Annulation optimiste immédiate
          setOrders(prevOrders);
          setReservations(prevReservations);
          setActiveTableId(prevActiveTableId);
        }
      }
    );
    if (activeTableId === sourceTableId) {
      setActiveTableId(targetTableId);
    }
  };

  const handleMergeTable = (sourceTableId, targetTableId) => {
    const sourceT = tables.find((t) => t.id === sourceTableId);
    const targetT = tables.find((t) => t.id === targetTableId);
    const sourceOrder = orders.find((o) => o.tableId === sourceTableId);
    const targetOrder = orders.find((o) => o.tableId === targetTableId);

    if (!sourceOrder || !targetOrder) return;

    // Snapshot pour rollback en cas de rejet serveur (Axe 3)
    const prevOrders = orders;
    const prevActiveTableId = activeTableId;

    setOrders((prev) => {
      const remaining = prev.filter((o) => o.id !== sourceOrder.id);
      return remaining.map((o) => {
        if (o.id !== targetOrder.id) return o;
        return {
          ...o,
          items: [...o.items, ...sourceOrder.items],
        };
      });
    });

    const socket = getSocket();
    if (!socket || !socket.connected) {
      pushToast(`🔗 Table ${sourceT?.number} fusionnée dans Table ${targetT?.number}`, "server");
    }

    emit(
      "tables:merge",
      { sourceTableId, targetTableId, staffName: currentStaff?.name },
      (res) => {
        if (res && res.ok === false) {
          // Annulation optimiste immédiate
          setOrders(prevOrders);
          setActiveTableId(prevActiveTableId);
        }
      }
    );
    if (activeTableId === sourceTableId) {
      setActiveTableId(targetTableId);
    }
  };

  // ── Actions Phase 4 : Réservations & Seating ────────────────
  const handleCreateReservation = (data) => {
    const newRes = {
      id: uid("res"),
      status: "confirmed",
      ...data,
    };
    setReservations((prev) => [newRes, ...prev]);
    emit("reservation:create", newRes);
    pushToast(`Réservation enregistrée pour ${data.customerName}`, "server");
  };

  const handleUpdateReservationStatus = (reservationId, status) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    emit("reservation:update_status", { id: reservationId, status });
  };

  const handleAssignReservationTable = (reservationId, tableId) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, tableId } : r))
    );
    emit("reservation:assign_table", { id: reservationId, tableId });
  };

  const handleDeleteReservation = (reservationId) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    emit("reservation:delete", { id: reservationId });
    pushToast("Réservation supprimée", "server");
  };

  return {
    getActiveOrder,
    ensureOrderForTable,
    createOffPremiseOrder,
    addProductToOrder,
    addComposedMenuToOrder,
    changeQty,
    removeItem,
    voidItem,
    setItemNote,
    sendToKitchen,
    serveAndMaybeFree,
    handleApplyDiscount,
    handleRemoveDiscount,
    checkoutOrder,
    partialCheckout,
    setOrderCovers,
    toggleAlert,
    startPrep,
    markReady,
    handleCallCourse,
    handleChangeItemCourse,
    handleTransferTable,
    handleMergeTable,
    handleCreateReservation,
    handleUpdateReservationStatus,
    handleAssignReservationTable,
    handleDeleteReservation,
  };
}
