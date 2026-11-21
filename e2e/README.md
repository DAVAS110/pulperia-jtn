# Pruebas de interfaz (Playwright)

Cubren los casos `TC-UI-*` de `backend/tests/QA_TEST_CASES.md`.

```bash
cd e2e
npm install        # una sola vez
npm test           # corre todo (escritorio + móvil)
npm run test:headed   # con el navegador visible
npm run report     # abre el reporte HTML de la última corrida
```

- Usa el **Chrome instalado** (no descarga navegadores).
- Levanta, o reutiliza si ya están corriendo, el backend (`:3001`) y Vite (`:5173`).
- **Solo corre contra una base de datos local** (Docker). Si `DATABASE_URL` apunta a otro host, se cancela.
- Crea usuarios y productos con prefijo `QA` y los borra al final; también restaura los saldos de Caja y SINPE.
- Es independiente del despliegue: esta carpeta no se sube a Render ni a Vercel.
