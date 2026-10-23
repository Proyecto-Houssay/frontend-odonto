# Novadent — Frontend

Interfaz web del sistema de gestión odontológica Novadent. Incluye el dashboard compartido, navegación por módulos y el odontograma académico integrado con la API. Los módulos que aún son placeholders se identifican como pendientes; no representan operaciones persistidas.

## Tecnologías

Versiones declaradas en `package.json` de la rama documentada:

| Tecnología | Versión | Uso |
|---|---|---|
| React / React DOM | `^19.2.8` | Interfaz |
| TypeScript | `~6.0.2` | Tipado estático |
| Vite | `^8.3.0` | Servidor y build |
| Tailwind CSS | `^4.3.3` | Estilos |
| React Router DOM | `^7.18.3` | Navegación |
| Lucide React | `^1.46.0` | Iconografía |
| Vitest | `^5.0.5` | Pruebas |
| Testing Library | `^16.3.3` / `^14.6.8` | Pruebas de interfaz |
| jsPDF | `^4.2.1` | PDF académico |
| React Signature Canvas | `^1.1.0-alpha.2` | Firma demostrativa |
## Requisitos

- Node.js y npm
- Backend Spring Boot local para probar funciones conectadas a la API

## Instalación y ejecución

```bash
git clone https://github.com/Proyecto-Houssay/frontend-odonto.git
cd frontend-odonto
npm install
npm run dev
```

Vite muestra la URL local, normalmente `http://localhost:5173`. En desarrollo, las solicitudes `/api` se envían al backend en `http://localhost:8080`.

Para apuntar a otro backend local en PowerShell:

```powershell
$env:ODONTO_API_TARGET = 'http://localhost:18080'
npm run dev -- --port 15173
```

En producción se necesita un backend accesible por HTTPS y un reverse proxy o configuración equivalente. El frontend alojado en Vercel no puede acceder al backend que corre únicamente en la computadora del desarrollador.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run lint` | Ejecuta Oxlint |
| `npm test` | Ejecuta las pruebas con Vitest |
| `npm run build` | Verifica TypeScript y genera `dist/` |
| `npm run preview` | Sirve localmente el build |

## Rutas

| Ruta | Módulo | Estado |
| --- | --- | --- |
| `/` | Dashboard | Estructura principal |
| `/pacientes` | Pacientes | Vista del módulo |
| `/odontologos` | Odontólogos | Vista del módulo |
| `/turnos` | Turnos | Vista del módulo |
| `/historias-clinicas` | Historias clínicas | Vista del módulo |
| `/usuarios` | Usuarios | Vista del módulo |
| `/informes` | Informes y caja | Placeholder |
| `/odontograma` | Odontograma académico | Integración demostrativa |
| `/pacientes/:pacienteId/odontograma` | Odontograma de paciente | Integración demostrativa |

Las vistas de módulos se completan junto con sus historias de usuario y tareas técnicas. La estructura de rutas y el layout son compartidos.


## Inicio de sesión y pacientes

Al abrir el frontend, iniciá sesión con una cuenta existente o usá **Crear una cuenta**. El alta pública llama `POST /api/auth/register`; si SMTP no está configurado, la cuenta igualmente se crea y la pantalla indica claramente que el correo no se envió. La aplicación llama `POST /api/auth/login` y conserva el JWT en `sessionStorage` de esta pestaña hasta cerrar sesión o vencer (15 minutos). El botón **Cerrar sesión** elimina esa sesión.

**Recuperar contraseña:** elegí **¿Olvidaste tu contraseña?**, ingresá el correo y seguí el enlace recibido para establecer una clave nueva. El mensaje no confirma si el correo pertenece a una cuenta. Para que los correos lleguen, configurá SMTP en el `.env` privado del backend y reinicialo; la guía está en el README del backend. Sin SMTP, la pantalla avisa que el envío no está configurado y no simula que se mandó un correo. El enlace por defecto apunta a `http://localhost:5174`; si Vite usa otro puerto, definí `APP_FRONTEND_BASE_URL` en el entorno del backend.

La pantalla **Pacientes** usa `GET`, `POST`, `PUT` y `DELETE /api/pacientes`, con los campos y validaciones que exige el backend. Crear y editar vuelven a cargar la lista para mostrar los datos confirmados por la API. Un DNI repetido o un paciente con registros vinculados se informa con el mensaje devuelto por el backend.


## Odontograma académico

La vista en `src/pages/Odontograma.jsx` es una demostración y no reemplaza la historia clínica. Para probarla, usar un paciente existente y un JWT vigente de rol `ODONTOLOGO` o `ADMINISTRADOR`, obtenido mediante `POST /api/auth/login` en Swagger. El login visual del dashboard no crea una sesión de API.

El token se ingresa en el campo enmascarado **Token Bearer** y permanece solo en memoria; no se guarda en `localStorage`. La pantalla permite seleccionar piezas, revisar la ficha del paciente, asignar condiciones, revisar un presupuesto ilustrativo, aceptar el consentimiento, firmar, guardar y generar un PDF. Solo una respuesta de guardado confirmada por la API indica persistencia; un PDF local se considera borrador.

Tratamientos y precios son ilustrativos y requieren validación profesional. No hay cobros. El catálogo y consentimiento `academic-v1` se verifican con la API antes de firmar; si cambia el paciente, la selección o el consentimiento, se invalida la firma. La redimensión del canvas también revoca la captura y la aceptación.

## Estructura del código

```text
src/
├── components/
│   └── layout/          # DashboardLayout, Navbar y Sidebar
├── pages/               # Dashboard, módulos y odontograma
├── App.tsx              # Rutas principales
├── main.tsx             # Punto de entrada React
└── index.css            # Tailwind y estilos globales
docs/
└── braian-dashboard.md  # Alcance e integración del dashboard
```

## Trabajo con el backend

La API debe estar levantada localmente para usar las funciones conectadas. Confirmar las rutas y roles vigentes en Swagger antes de integrar un módulo. Manejar los estados de carga, vacío, error, validación, falta de autorización y éxito; no reemplazar silenciosamente errores de API con mocks.

No incluir contraseñas, tokens, archivos `.env` ni datos personales reales en commits.

## Flujo de trabajo del repositorio

- `develop` es la rama de integración definida por el equipo.
- Las ramas de trabajo identifican a cada integrante.
- Los Pull Requests se revisan antes de integrarse a `develop` y deben vincular la HU/TR correspondiente.
- Cerrar una issue requiere verificar sus criterios de aceptación y las pruebas relevantes.

## Documentación

- [Alcance del dashboard de Braian](docs/braian-dashboard.md)
- [Wiki del frontend Novadent](https://github.com/Proyecto-Houssay/frontend-odonto/wiki)
- [Arquitectura](https://github.com/Proyecto-Houssay/frontend-odonto/wiki/Arquitectura-Frontend)
- [Tecnologías y ejecución](https://github.com/Proyecto-Houssay/frontend-odonto/wiki/Tecnologias-y-Ejecucion)
- [Product Backlog](https://github.com/Proyecto-Houssay/frontend-odonto/wiki/Product-Backlog)
- [Flujo de trabajo](https://github.com/Proyecto-Houssay/frontend-odonto/wiki/Flujo-de-Trabajo)
- [Repositorio del backend](https://github.com/Proyecto-Houssay/backend-odonto)

La Wiki está publicada y organiza la arquitectura, el stack, el backlog y los sprints del frontend.
