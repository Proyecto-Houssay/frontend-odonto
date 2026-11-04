# Novadent — Frontend

Prototipo frontend del sistema odontológico Novadent. En esta rama incluye un asistente conectado al backend con citas y vistas de consulta para inventario e informes.

## Stack

- React 19, TypeScript y Vite 8.
- Tailwind CSS v4 y React Router DOM.
- Vitest, Testing Library y jsdom para pruebas de interfaz.

## Inicio rápido

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

El archivo `.env.local` usa `VITE_API_BASE_URL` con la URL raíz del backend, por ejemplo `http://localhost:8080` (sin `/api`). El servidor de desarrollo suele quedar en `http://localhost:5173`.

## Rutas

- `/chatbot` — consulta el endpoint real `POST /api/chatbot/ask`, muestra documentos, versiones y fragmentos citados, y representa carga, error y falta de evidencia. No crea respuestas de respaldo si el backend falla.
- `/informes` — consulta inventario persistido, turnos por período y resumen anual mediante `/api/reports/*`.

El backend de esta rama aún no ofrece autenticación real con roles; estas vistas no constituyen un portal autenticado ni informes protegidos. No deben exponerse como tales hasta integrar el control de acceso del backend.

## Alcance de informes

Ganancias y cobros no se muestran porque el backend no registra pagos ni ofrece esos endpoints. El informe por período cuenta turnos registrados; no los afirma como atenciones completadas. La pantalla de inventario es de solo consulta, porque no existe una operación de eliminación ni un rol de usuario verificable en esta rama.

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor local |
| `npm run lint` | Ejecuta Oxlint |
| `npm test` | Ejecuta las pruebas de interfaz |
| `npm run build` | Valida TypeScript y genera el build de producción |
| `npm run preview` | Sirve el build generado |

## Seguridad de datos

El asistente acepta preguntas generales y muestra el material devuelto por el backend. No brinda diagnósticos, no recomienda medicamentos y advierte cuando no hay evidencia suficiente. El token administrativo de gestión de documentos se configura solo en el backend; nunca debe incluirse en el frontend.
