# Novadent — Frontend

Frontend del sistema de gestión odontológica. Esta aplicación presenta el dashboard compartido y las vistas base que cada integrante ampliará en su módulo.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router DOM v7
- Lucide React

## Inicio rápido

```bash
git clone https://github.com/Proyecto-Houssay/frontend-odonto.git
cd frontend-odonto
npm install
npm run dev
```

El servidor de desarrollo queda disponible en la URL que muestre Vite, normalmente `http://localhost:5173`.

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run lint` | Ejecuta Oxlint |
| `npm run build` | Ejecuta TypeScript y genera el build de producción |
| `npm run preview` | Sirve localmente el build generado |
| `npm test` | Ejecuta pruebas del odontograma y generación real de PDF |

## Odontograma académico

Abrir `/odontograma` e ingresar el ID de un paciente existente, o `/pacientes/ID/odontograma`. El enlace **Odontograma** está en el menú. La pantalla en `src/pages/Odontograma.jsx` conserva JavaScript y no reemplaza el módulo de historias clínicas.

Se requiere un JWT real de `ODONTOLOGO` o `ADMINISTRADOR`, obtenido con `POST /api/auth/login` en Swagger. Pegarlo en el campo enmascarado **Token Bearer (solo en memoria)**; el login visual del dashboard no inicia una sesión de API. Seleccionar piezas, consultar la ficha debajo del odontograma, asignar condiciones, revisar el presupuesto, aceptar el consentimiento, dibujar y capturar la firma, guardar y ejecutar **Descargar PDF con Firma**. Solo **Guardado #ID** confirma persistencia; un PDF local se identifica como borrador. Tratamientos y precios son ilustrativos y requieren validación profesional. No hay cobros.

Vite proxifica `/api` a `http://localhost:8080`. Para otro backend de desarrollo: `$env:ODONTO_API_TARGET='http://localhost:18080'; npm run dev -- --port 15173`. En producción, configurar un reverse proxy equivalente. La página también se importa sin router y acepta props opcionales `pacienteId`, `token` y `apiUrl` (por defecto `/api`), sin guardar el token en `localStorage`.

El catálogo y consentimiento `academic-v1` se verifican con la API antes de firmar. Cambiar paciente, piezas o consentimiento invalida la firma. Redimensionar el canvas revoca captura y aceptación para evitar una firma desalineada. Consultar la guía `docs/odontograma-academico.md` del backend para el flujo Swagger → interfaz → GET → Workbench y los límites de la simulación.

## Estructura principal

```text
src/
├── components/layout/   # DashboardLayout, Navbar y Sidebar
├── pages/               # Dashboard y vistas de módulos
├── App.tsx              # Router principal
├── main.tsx             # Punto de entrada
└── index.css            # Tailwind y estilos globales
docs/
└── braian-dashboard.md  # Alcance e integración del dashboard
```

## Rutas del dashboard

- `/` — Dashboard principal
- `/pacientes` — Pacientes
- `/odontologos` — Odontólogos
- `/turnos` — Turnos
- `/historias-clinicas` — Historias clínicas
- `/usuarios` — Gestión de usuarios
- `/informes` — Informes y caja (placeholder)

Las rutas y el layout son infraestructura compartida. Cada integrante debe reemplazar solamente el contenido de su módulo y conservar el contrato de navegación.

## Flujo de trabajo

- `develop` es la base de integración.
- Las ramas de trabajo son `Mateo`, `Kevin`, `Braian`, `Josue` e `Iris`.
- Los Pull Requests deben apuntar a `develop` y vincular su HU/TR correspondiente.
- No se deben publicar secretos ni archivos `.env`.

## Alcance actual

El dashboard contiene estructura, navegación y placeholders. Autenticación, permisos, CRUDs, informes reales y consumo de API quedan pendientes de sus respectivas HU/TR.

Para conocer el límite de integración con el backend, consultar [`docs/braian-dashboard.md`](docs/braian-dashboard.md) y la [wiki del proyecto](https://github.com/Proyecto-Houssay/backend-odonto/wiki).
