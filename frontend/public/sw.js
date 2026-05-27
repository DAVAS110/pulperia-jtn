/**
 * Service Worker personalizado para Pulpería JTN
 * Maneja caché, sincronización en background y notificaciones push
 */

const CACHE_NAME = "pulperia-v1";
const STATIC_CACHE = "pulperia-static-v1";
const API_CACHE = "pulperia-api-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const API_ROUTES = [
  "/api/products",
  "/api/categories",
  "/api/sales",
  "/api/reports",
];

// ─── Instalación del Service Worker ───────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando...");
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll(STATIC_ASSETS);
        console.log("[SW] Assets estáticos cacheados");
        self.skipWaiting();
      } catch (err) {
        console.error("[SW] Error durante instalación:", err);
      }
    })(),
  );
});

// ─── Activación del Service Worker ────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando...");
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (
            name !== STATIC_CACHE &&
            name !== API_CACHE &&
            name !== CACHE_NAME
          ) {
            console.log("[SW] Eliminando caché antiguo:", name);
            return caches.delete(name);
          }
        }),
      );
      self.clients.claim();
      console.log("[SW] Activación completa");
    })(),
  );
});

// ─── Estrategia: Network First para APIs ──────────────────
const networkFirstStrategy = async (request) => {
  try {
    const response = await fetch(request);

    // Cachear respuestas exitosas
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    console.log("[SW] Network failed, usando caché:", request.url);
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    // Fallback para APIs
    return new Response(
      JSON.stringify({
        error: "No disponible offline",
        message: "La conexión a internet es requerida para esta operación",
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

// ─── Estrategia: Cache First para assets estáticos ─────────
const cacheFirstStrategy = async (request) => {
  const cached = await caches.match(request);

  if (cached) {
    console.log("[SW] Usando caché:", request.url);
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok && request.method === "GET") {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    console.error("[SW] Error fetching:", request.url, err);
    return new Response("No disponible offline", { status: 503 });
  }
};

// ─── Fetch Event ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones a dominios externos
  if (url.origin !== self.location.origin) {
    return;
  }

  // APIs: Network First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Assets: Cache First
  if (
    request.destination === "image" ||
    request.destination === "stylesheet" ||
    request.destination === "font" ||
    request.destination === "script" ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML: Network First
  if (request.destination === "document") {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Por defecto: Network First
  event.respondWith(networkFirstStrategy(request));
});

// ─── Background Sync (sincronización en background) ────────
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-sales") {
    event.waitUntil(syncPendingSales());
  } else if (event.tag === "sync-inventory") {
    event.waitUntil(syncInventory());
  }
});

async function syncPendingSales() {
  try {
    const db = await openDB();
    const pendingSales = await getPendingSales(db);

    for (const sale of pendingSales) {
      await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sale),
      });
    }

    await clearPendingSales(db);
    console.log("[SW] Ventas sincronizadas");
  } catch (err) {
    console.error("[SW] Error sincronizando ventas:", err);
    throw err;
  }
}

async function syncInventory() {
  try {
    await fetch("/api/inventory/sync", { method: "POST" });
    console.log("[SW] Inventario sincronizado");
  } catch (err) {
    console.error("[SW] Error sincronizando inventario:", err);
    throw err;
  }
}

// ─── Notificaciones Push ──────────────────────────────────
self.addEventListener("push", (event) => {
  console.log("[SW] Push recibido:", event.data);

  let notificationData = {
    title: "Pulperia JTN",
    body: "Tienes una notificación nueva",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: "pulperia-notification",
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (err) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title,
      notificationData,
    ),
  );
});

// ─── Click en notificaciones ──────────────────────────────
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notificación clickeada:", event.notification.tag);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Buscar si ya existe una ventana con la URL
        for (let client of clients) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // Si no existe, abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

// ─── Utilidades de IndexedDB (para sincronización offline) ─
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PulperiaDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id" });
      }
    };
  });
}

function getPendingSales(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSales", "readonly");
    const store = transaction.objectStore("pendingSales");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function clearPendingSales(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSales", "readwrite");
    const store = transaction.objectStore("pendingSales");
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
