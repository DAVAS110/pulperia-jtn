# 📱 PWA - Pulpería JTN

Guía completa para instalar y usar Pulpería JTN como una aplicación nativa en iOS y Android.

## ¿Qué es una PWA?

Una **Progressive Web App (PWA)** es una aplicación web que funciona como una app nativa:

- ✅ Se instala en la pantalla de inicio
- ✅ Funciona offline (sin conexión a internet)
- ✅ Carga rápidamente
- ✅ Recibe notificaciones push
- ✅ No requiere App Store o Play Store

---

## 📲 Instalación en Android

### 1️⃣ En Chrome/Navegador

1. Abre Pulpería JTN en tu navegador
2. Toca el menú de **tres puntos** (⋮) arriba a la derecha
3. Selecciona **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**
4. Confirma la instalación

**Resultado:** La app aparecerá en tu pantalla de inicio como una app normal

### 2️⃣ Alternativa - Mediante el banner automático

Si ves un **banner azul abajo de la pantalla** que dice "Instalar Pulperia JTN":

- Toca el botón **"Instalar"**
- Confirma en el diálogo que aparece

### 3️⃣ Una vez instalada

- Toca el ícono en la pantalla de inicio
- La app se abrirá a **pantalla completa** sin las barras del navegador
- Tiene todos los mismos accesos directos que en el navegador

---

## 🍎 Instalación en iPhone/iPad

### ⚠️ Importante para iOS

iOS no permite el banner automático de instalación como Android. Debes hacerlo manualmente:

### 📋 Pasos para instalar

1. **Abre Safari** (es importante usar Safari, no Chrome)

2. **Abre Pulpería JTN** en Safari

3. **Toca el botón Compartir** (icono de cuadro con flecha ⬆️)
   - Está en la barra inferior de Safari

4. **Desplázate hacia abajo** en el menú que aparece

5. **Toca "Agregar a la pantalla de inicio"**
   - En inglés: "Add to Home Screen"

6. **Personaliza el nombre** (opcional)
   - Por defecto dice "Pulpería JTN"

7. **Toca "Agregar"** arriba a la derecha

**Resultado:** La app aparecerá en tu pantalla de inicio

### ✨ Ventajas en iPhone

- Se abre a **pantalla completa** sin Safari
- Acceso rápido desde la pantalla de inicio
- Funciona offline (si los datos fueron cacheados)
- **Barra de estado** personalizada

---

## 🌐 Funcionalidades PWA

### 1. **Funciona Offline**

- Después de tu primer uso, los datos se guardan en caché
- Puedes ver información anterior aunque no tengas internet
- Las nuevas ventas/cambios se sincronizarán cuando reconectes

### 2. **Accesos Directos (Shortcuts)**

Mantén presionado el ícono de la app (Android) o 3D Touch (iPhone):

- **Caja / POS** - Acceso rápido a ventas
- **Productos** - Gestionar inventario
- **Reportes** - Ver análisis

### 3. **Notificaciones Push**

La app te notificará sobre:

- ⚠️ Productos con bajo stock
- 📊 Reportes completados
- 🔔 Alertas importantes

**Para activar:**

1. La app te pedirá permiso la primera vez
2. Acepta las notificaciones
3. Toca el botón 🔔 en la interfaz

### 4. **Sincronización en Background**

- Las ventas se sincronizarán automáticamente cuando reconectes
- Los cambios de inventario se guardan localmente
- Todo se actualiza cuando hay conexión

---

## 🔄 Actualizaciones

### ¿Cómo recibe actualizaciones la app?

- **Android:** Se actualiza automáticamente (sin necesidad de ir a Play Store)
- **iPhone:** Se actualiza automáticamente
- Verás un banner verde diciendo **"Actualización disponible"**

### Actualizar manualmente

1. Toca el banner verde de actualización
2. Toca el botón **"Actualizar ahora"**
3. La app se recargará con la versión más reciente

---

## 📊 Caché y Almacenamiento

### ¿Qué datos se guardan?

- 📦 Lista de productos (24 horas)
- 🏷️ Categorías (24 horas)
- 💰 Ventas recientes (para sincronizar)
- 📱 Imágenes de la app (30 días)

### Liberar espacio

- **Android:** Ajustes > Aplicaciones > Pulpería JTN > Almacenamiento > Borrar caché
- **iPhone:** Configuración > General > Almacenamiento de iPhone > Pulpería JTN > Descargar (lo recargará cuando lo necesites)

---

## 🔐 Seguridad

- Tu sesión es privada y segura
- Los datos offline se guardan en IndexedDB (seguro)
- Las contraseñas NO se guardan localmente
- Solo tu usuario tiene acceso a los datos

---

## ❓ Preguntas Frecuentes

### ¿Puedo usarla sin datos móviles?

**Parcialmente.** Después de usar la app con conexión, puedes:

- Ver datos ya cacheados
- Navegar por las páginas
- NO puedes hacer nuevas ventas

Cuando reconectes, se sincronizarán automáticamente.

### ¿Ocupa mucho espacio?

**No.** La app pesa ~30-50 MB (similar a una app nativa)

### ¿Es más rápida que usar el navegador?

**Sí.** Se abre más rápido, es más fluida y no tiene las barras del navegador.

### ¿Puedo desinstalarlo?

**Sí.**

- **Android:** Mantén presionado el ícono > Desinstalar
- **iPhone:** Mantén presionado > Remover App

### ¿Funciona en otros navegadores?

- **Android:** Chrome, Edge, Brave ✅ | Firefox ⚠️ (limitado)
- **iPhone:** Solo Safari ✅ (es la única opción en iOS)

---

## 🐛 Problemas comunes

### "No me aparece el banner de instalación"

- Refresca la página (desliza hacia abajo)
- Borra el caché del navegador
- Intenta en una pestaña incógnita

### "La app se cierra cuando la inicio"

- Fuerza el cierre completo
- Vuelve a instalarla
- Borra el caché (Ajustes > Apps > Pulpería JTN > Almacenamiento)

### "No funciona sin internet"

- Abre la app con conexión al menos una vez para cachear datos
- Solo funcionará offline para las páginas ya visitadas

### "Las notificaciones no llegan"

- Verifica que hayas dado permiso en Ajustes
- Revisa que las notificaciones estén habilitadas para la app

---

## 📞 Soporte

Si tienes problemas:

1. Intenta borrar datos/caché de la app
2. Desinstala y vuelve a instalar
3. Contacta al administrador del sistema

---

**¡Disfruta usando Pulpería JTN como una app nativa! 🚀**
