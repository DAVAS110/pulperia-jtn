# 🏪 Pulperia JTN — Sistema de Gestión de Inventario

Stack completo: **React + Node.js/Express + PostgreSQL (Supabase)**  
Deploy: **Vercel (frontend) + Render (backend)**

---

## 📁 Estructura del Proyecto

```
pulperia/
├── backend/          ← Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js       ← Conexión PostgreSQL
│   │   │   └── schema.sql        ← ⭐ Ejecutar en Supabase primero
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── categories.controller.js
│   │   │   ├── products.controller.js
│   │   │   ├── inventory.controller.js
│   │   │   ├── sales.controller.js
│   │   │   └── reports.controller.js
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT middleware
│   │   ├── routes/
│   │   │   └── index.js          ← Todas las rutas
│   │   └── index.js              ← Entry point Express
│   ├── package.json
│   └── .env.example
│
└── frontend/         ← React + Vite
    ├── src/
    │   ├── components/
    │   │   ├── layout/AppLayout.jsx   ← Sidebar + topbar
    │   │   └── ui/index.jsx           ← Componentes reutilizables
    │   ├── pages/
    │   │   ├── AuthPage.jsx       ← Login + Registro
    │   │   ├── Dashboard.jsx
    │   │   ├── Productos.jsx      ← CRUD productos
    │   │   ├── Categorias.jsx     ← CRUD categorías
    │   │   ├── Movimientos.jsx    ← Entradas/salidas stock
    │   │   ├── Alertas.jsx        ← Bajo stock
    │   │   ├── Caja.jsx           ← POS / punto de venta
    │   │   ├── Ventas.jsx         ← Historial ventas
    │   │   ├── QRPage.jsx         ← QR + escáner
    │   │   ├── Reportes.jsx       ← Gráficos + CSV
    │   │   └── Configuracion.jsx  ← Usuarios + ajustes
    │   ├── services/api.js        ← Axios + endpoints
    │   ├── store/
    │   │   ├── authStore.js       ← Zustand auth state
    │   │   └── toastStore.js      ← Notificaciones
    │   ├── utils/helpers.js       ← Formatters, utilidades
    │   ├── index.css              ← Design system CSS
    │   └── main.jsx               ← Router + entry point
    ├── package.json
    └── .env.example
```

---

## 🚀 Setup Paso a Paso

### 1. Base de Datos en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `backend/src/config/schema.sql`
3. Copia la **Connection String** desde _Project Settings → Database → Connection string → URI_

### 2. Backend — Deploy en Render

1. Sube el código a GitHub
2. En [render.com](https://render.com), crea un **Web Service** apuntando a la carpeta `backend/`
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Agrega las variables de entorno:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=una_clave_muy_larga_y_segura_aqui
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://tu-app.vercel.app
NODE_ENV=production
PORT=3001
```

5. Copia la URL de tu servicio Render (ej: `https://pulperia-api.onrender.com`)

### 3. Frontend — Deploy en Vercel

1. En [vercel.com](https://vercel.com), importa el repositorio
2. Configura el **Root Directory** como `frontend`
3. Agrega la variable de entorno:

```env
VITE_API_URL=https://pulperia-api.onrender.com/api
```

4. Deploy ✅

---

## 🏃 Desarrollo Local

```bash
# Backend
cd backend
cp .env.example .env       # Edita con tus valores
npm install
npm run dev                # Corre en http://localhost:3001

# Frontend (nueva terminal)
cd frontend
cp .env.example .env       # VITE_API_URL=http://localhost:3001/api
npm install
npm run dev                # Corre en http://localhost:5173
```

---

## 📡 API REST — Endpoints

### Autenticación

| Método | Ruta                  | Descripción                |
| ------ | --------------------- | -------------------------- |
| POST   | `/api/auth/register`  | Crear cuenta               |
| POST   | `/api/auth/login`     | Iniciar sesión             |
| GET    | `/api/auth/me`        | Perfil actual              |
| GET    | `/api/auth/users`     | Lista usuarios (admin)     |
| PATCH  | `/api/auth/users/:id` | Actualizar usuario (admin) |

### Categorías

| Método | Ruta                  | Descripción        |
| ------ | --------------------- | ------------------ |
| GET    | `/api/categories`     | Listar todas       |
| POST   | `/api/categories`     | Crear (admin)      |
| PUT    | `/api/categories/:id` | Actualizar (admin) |
| DELETE | `/api/categories/:id` | Eliminar (admin)   |

### Productos

| Método | Ruta                     | Descripción                                |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/products`          | Listar (search, category_id, status, sort) |
| GET    | `/api/products/:id`      | Obtener uno                                |
| GET    | `/api/products/sku/:sku` | Buscar por SKU                             |
| POST   | `/api/products`          | Crear                                      |
| PUT    | `/api/products/:id`      | Actualizar                                 |
| DELETE | `/api/products/:id`      | Eliminar soft (admin)                      |

### Inventario

| Método | Ruta             | Descripción           |
| ------ | ---------------- | --------------------- |
| GET    | `/api/inventory` | Historial movimientos |
| POST   | `/api/inventory` | Registrar movimiento  |

### Ventas

| Método | Ruta             | Descripción                          |
| ------ | ---------------- | ------------------------------------ |
| GET    | `/api/sales`     | Historial ventas                     |
| POST   | `/api/sales`     | Registrar venta (descuenta stock)    |
| DELETE | `/api/sales/:id` | Anular venta (admin, restaura stock) |

### Reportes

| Método | Ruta                     | Descripción        |
| ------ | ------------------------ | ------------------ |
| GET    | `/api/reports/dashboard` | Métricas generales |
| GET    | `/api/reports/sales`     | Ventas por período |
| GET    | `/api/reports/inventory` | Estado inventario  |

---

## 🗃️ Tablas de Base de Datos

| Tabla                 | Descripción                           |
| --------------------- | ------------------------------------- |
| `users`               | Usuarios del sistema (admin/employee) |
| `categories`          | Categorías de productos con color     |
| `products`            | Productos con precios, stock y SKU    |
| `inventory_movements` | Registro de entradas/salidas          |
| `sales`               | Ventas completadas o anuladas         |
| `sale_items`          | Items de cada venta                   |

---

## ✨ Funcionalidades

- ✅ **Auth** – JWT con roles admin/empleado
- ✅ **Dashboard** – Métricas en tiempo real
- ✅ **Productos** – CRUD completo con filtros y búsqueda
- ✅ **Categorías** – CRUD con selector de color
- ✅ **Inventario** – Entradas, salidas, ajustes, pérdidas
- ✅ **Alertas** – Productos bajo stock con barra visual
- ✅ **Caja/POS** – Punto de venta, búsqueda, carrito, cambio
- ✅ **Ventas** – Historial, detalle, anulación
- ✅ **QR** – Generación, impresión, escáner con cámara
- ✅ **Reportes** – Gráficos Chart.js + exportación CSV
- ✅ **Configuración** – Gestión de usuarios (admin)
- ✅ **Responsive** – Funciona en móvil y desktop
- ✅ **Transacciones DB** – Ventas e inventario con ROLLBACK
"# pulperia-jtn" 
