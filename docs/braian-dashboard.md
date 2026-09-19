# Dashboard de Braian

## Resultado

La rama `Braian` contiene el esqueleto navegable del dashboard de Novadent: layout compartido, barra superior, menú lateral, rutas base y vistas placeholder. Este bloque permite que el resto del equipo integre sus módulos sin modificar la estructura de navegación.

## Alcance de este cambio

- `DashboardLayout`: composición de `Navbar`, `Sidebar` y `Outlet`.
- `Navbar`: identidad del usuario, notificaciones, cierre de sesión simulado y apertura del menú móvil.
- `Sidebar`: navegación activa hacia los módulos del sistema y comportamiento responsive.
- Rutas base para inicio, pacientes, odontólogos, turnos, historias clínicas, usuarios e informes.
- Vistas placeholder para que cada integrante pueda reemplazar únicamente el contenido de su módulo.

## Fuera de alcance

- Autenticación real, permisos y roles persistidos.
- Integración con API o base de datos.
- CRUDs, informes, caja, inventario y reglas clínicas.
- Cambios en módulos asignados a Mateo, Kevin, Josue o Iris.

## Organización

| Responsabilidad | Ubicación |
|---|---|
| Rutas y layout | `src/App.tsx`, `src/components/layout/DashboardLayout.tsx` |
| Barra superior | `src/components/layout/Navbar.tsx` |
| Navegación lateral | `src/components/layout/Sidebar.tsx` |
| Inicio del dashboard | `src/pages/DashboardHome.tsx` |
| Placeholders de módulos | `src/pages/*Page.tsx` |

## Rutas disponibles

| Ruta | Vista |
|---|---|
| `/` | Dashboard principal |
| `/pacientes` | Pacientes |
| `/odontologos` | Odontólogos |
| `/turnos` | Turnos |
| `/historias-clinicas` | Historias clínicas |
| `/usuarios` | Gestión de usuarios |
| `/informes` | Informes y caja (placeholder) |
| cualquier otra | Página 404 |

## Integración para el equipo

1. Crear o mantener la rama propia desde `develop`.
2. Reemplazar el contenido de la página correspondiente sin cambiar el contrato de rutas.
3. Mantener `DashboardLayout`, `Navbar` y `Sidebar` como infraestructura compartida.
4. Abrir el Pull Request hacia `develop` y vincularlo con la HU/TR del módulo.

## Verificación

```bash
npm install
npm run lint
npm run build
```

La integración con el backend queda documentada en `backend-odonto/docs/braian-dashboard-integration.md`.
