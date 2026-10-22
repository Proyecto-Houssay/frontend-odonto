# Novadent — Frontend

Interfaz web del sistema de gestión odontológica Novadent, construida con React y TypeScript.

## Qué contiene

La aplicación organiza la navegación y las vistas de pacientes, odontólogos, turnos, historias clínicas, usuarios e informes. Las operaciones disponibles dependen de la API y de los permisos del usuario autenticado.

## Tecnologías

- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React

## Ejecutar en desarrollo

1. Instalar dependencias: npm ci
2. Iniciar Vite: npm run dev
3. Abrir la URL local que informa Vite.

Comprobaciones disponibles: npm run build y npm run lint.

Configura la URL del backend en el entorno local según la configuración de la aplicación. No subas archivos de entorno locales, credenciales ni tokens. El frontend en local requiere que Spring Boot esté ejecutándose; publicar la interfaz en Vercel no crea por sí solo un backend o una base de datos en la nube.

## Planificación del producto

- [Product Backlog](docs/plan/product-backlog.md)
- [Sprint 0 — Configuración](docs/plan/sprints/sprint-0.md)
- [Sprint 1 — Estructura base](docs/plan/sprints/sprint-1.md)
- [Sprint 2 — Acceso y roles](docs/plan/sprints/sprint-2.md)
- [Sprint 3 — Pacientes y profesionales](docs/plan/sprints/sprint-3.md)
- [Sprint 4 — Agenda y turnos](docs/plan/sprints/sprint-4.md)
- [Sprint 5 — Historia clínica y odontograma académico](docs/plan/sprints/sprint-5.md)
- [Sprint 6 — Administración e informes](docs/plan/sprints/sprint-6.md)
- [Borradores de Wiki](docs/wiki-drafts/Home.md)

Las páginas de planificación describen objetivos y criterios; los módulos se consideran terminados solo cuando sus issues y criterios están verificados.
