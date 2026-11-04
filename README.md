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

- `/ingresar` — obtiene una sesión del backend y la conserva durante una hora o hasta cerrar sesión.
- `/chatbot` — solo PATIENT y ADMIN pueden consultar `POST /api/chatbot/ask`; muestra documentos, versiones y fragmentos citados.
- `/informes` — ADMIN, RECEPCIONISTA y ODONTOLOGO consultan datos; ADMIN puede registrar/editar insumos y registrar ingresos/egresos. Las vistas y acciones siguen los permisos que valida el backend.

El backend debe tener configurados `AUTH_JWT_SECRET` (32 bytes como mínimo) y las credenciales del rol que ingresa. No hay usuarios o contraseñas por defecto; consultá el README del backend para las variables requeridas. La interfaz conserva el token solo en `sessionStorage` y lo envía como bearer en las llamadas protegidas.

## Alcance de informes

Los cobros y el resultado financiero se calculan solo con movimientos persistidos en el backend. Un cobro debe vincularse a un turno existente; la pantalla no muestra valores demostrativos. El informe distingue turnos registrados de atenciones marcadas como `COMPLETADO`. La aplicación no ofrece eliminación de insumos porque la API no define esa operación.

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor local |
| `npm run lint` | Ejecuta Oxlint |
| `npm test` | Ejecuta las pruebas de interfaz |
| `npm run build` | Valida TypeScript y genera el build de producción |
| `npm run preview` | Sirve el build generado |

## Seguridad de datos

El asistente acepta preguntas generales y muestra el material devuelto por el backend. No brinda diagnósticos, no recomienda medicamentos y advierte cuando no hay evidencia suficiente. La clave JWT y las credenciales se configuran solo en el backend; nunca deben incluirse en el frontend.
