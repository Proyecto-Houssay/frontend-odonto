# Arquitectura del frontend

## Stack

React, TypeScript y Vite; estilos con Tailwind CSS; navegación con React Router; iconografía Lucide React.

## Estructura funcional

- DashboardLayout compone Navbar, Sidebar y las vistas hijas.
- React Router mantiene navegación SPA y ruta 404.
- El cliente API centraliza URL base, JSON, JWT y errores.
- Los guards de ruta controlan la experiencia; el backend conserva la autorización definitiva.

## Integración

- Desarrollo local: configurar la URL del backend en el entorno de desarrollo.
- El backend Spring Boot local expone Swagger para confirmar rutas y contratos vigentes.
- No guardar secretos, JWT ni contraseñas en el repositorio.
- Con JWT vencido, limpiar sesión; con 403, mostrar permiso denegado sin borrar una sesión válida.
- Manejar errores de red, validación, vacío y carga sin reemplazar respuestas reales por mocks silenciosos.

## Límites actuales

Vercel puede alojar la interfaz, pero el frontend solo podrá usar API de nube cuando exista un backend accesible por HTTPS y configuración de CORS adecuada. El uso local de Spring Boot y MySQL/mocks no implica que exista una API pública.
