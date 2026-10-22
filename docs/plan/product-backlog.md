# Product Backlog — Frontend Novadent

**Repositorio:** [frontend-odonto](https://github.com/Proyecto-Houssay/frontend-odonto)  
**Última revisión:** 2026-10-22  
**Criterio:** ordenar por dependencia y valor; las HU/TR permanecen abiertas hasta verificar sus criterios. Los HUs nuevos se estiman dentro de su milestone, no se asignan a una persona ni reciben fechas sin planificación del equipo.

## Resumen del estado

- Sprint 0: 2 issues abiertos, 0 cerrados.
- Sprint 1: 7 issues abiertos, 1 cerrado; se agregó TR-28 para quitar metadatos de planificación y cifras mock de la interfaz. Falta completar el Dashboard navegable antes de entrar al trabajo de módulos.
- Sprints 2–6: organizados como milestones nuevos; issues de trabajo listados debajo.
- Ningún milestone tiene fechas comprometidas.

## Backlog priorizado

| Prioridad | Sprint | Historia | Estado/criterio |
|---|---|---|---|
| P0 | Sprint 0 | [#11](https://github.com/Proyecto-Houssay/frontend-odonto/issues/11) HU-00 — Alinear repositorio y flujo | Abierta; desbloquea integración |
| P0 | Sprint 1 | [#1](https://github.com/Proyecto-Houssay/frontend-odonto/issues/1) HU-01 — Estructura base del Dashboard | Abierta; bloquea módulos |
| P1 | Sprint 2 | [#13](https://github.com/Proyecto-Houssay/frontend-odonto/issues/13) HU-02 — Iniciar/cerrar sesión | Abierta; requiere contrato auth |
| P1 | Sprint 2 | [#14](https://github.com/Proyecto-Houssay/frontend-odonto/issues/14) HU-03 — Acceso por rol | Abierta; depende de sesión |
| P2 | Sprint 3 | [#15](https://github.com/Proyecto-Houssay/frontend-odonto/issues/15) HU-04 — Gestionar pacientes | Abierta; depende de auth |
| P2 | Sprint 3 | [#16](https://github.com/Proyecto-Houssay/frontend-odonto/issues/16) HU-05 — Odontólogos y especialidades | Abierta; usado por agenda |
| P3 | Sprint 4 | [#17](https://github.com/Proyecto-Houssay/frontend-odonto/issues/17) HU-06 — Agenda y turnos | Abierta; depende de pacientes/profesionales |
| P4 | Sprint 5 | [#18](https://github.com/Proyecto-Houssay/frontend-odonto/issues/18) HU-07 — Historia clínica | Abierta; datos sensibles por rol |
| P4 | Sprint 5 | [#19](https://github.com/Proyecto-Houssay/frontend-odonto/issues/19) HU-08 — Odontograma académico | Abierta; alcance demostrativo |
| P5 | Sprint 6 | [#20](https://github.com/Proyecto-Houssay/frontend-odonto/issues/20) HU-09 — Administración de usuarios | Abierta; solo administrador |
| P5 | Sprint 6 | [#21](https://github.com/Proyecto-Houssay/frontend-odonto/issues/21) HU-10 — Informes e inventario soportados | Abierta; resolver brecha de cobros |

## Tareas técnicas existentes

- Sprint 0: [#12](https://github.com/Proyecto-Houssay/frontend-odonto/issues/12) TR-00 (abierta).
- Sprint 1: [#2](https://github.com/Proyecto-Houssay/frontend-odonto/issues/2) TR-01 (cerrada); [#3](https://github.com/Proyecto-Houssay/frontend-odonto/issues/3) TR-02, [#4](https://github.com/Proyecto-Houssay/frontend-odonto/issues/4) TR-03, [#5](https://github.com/Proyecto-Houssay/frontend-odonto/issues/5) TR-04, [#6](https://github.com/Proyecto-Houssay/frontend-odonto/issues/6) TR-05 y [#7](https://github.com/Proyecto-Houssay/frontend-odonto/issues/7) TR-06 (abiertas).

## Tareas técnicas planificadas por sprint

- Sprint 2: [#22](https://github.com/Proyecto-Houssay/frontend-odonto/issues/22) TR-07, [#23](https://github.com/Proyecto-Houssay/frontend-odonto/issues/23) TR-08, [#24](https://github.com/Proyecto-Houssay/frontend-odonto/issues/24) TR-09, [#25](https://github.com/Proyecto-Houssay/frontend-odonto/issues/25) TR-10.
- Sprint 3: [#26](https://github.com/Proyecto-Houssay/frontend-odonto/issues/26) TR-11, [#27](https://github.com/Proyecto-Houssay/frontend-odonto/issues/27) TR-12, [#28](https://github.com/Proyecto-Houssay/frontend-odonto/issues/28) TR-13, [#29](https://github.com/Proyecto-Houssay/frontend-odonto/issues/29) TR-14.
- Sprint 4: [#30](https://github.com/Proyecto-Houssay/frontend-odonto/issues/30) TR-15, [#31](https://github.com/Proyecto-Houssay/frontend-odonto/issues/31) TR-16, [#32](https://github.com/Proyecto-Houssay/frontend-odonto/issues/32) TR-17, [#33](https://github.com/Proyecto-Houssay/frontend-odonto/issues/33) TR-18.
- Sprint 5: [#34](https://github.com/Proyecto-Houssay/frontend-odonto/issues/34) TR-19, [#35](https://github.com/Proyecto-Houssay/frontend-odonto/issues/35) TR-20, [#36](https://github.com/Proyecto-Houssay/frontend-odonto/issues/36) TR-21, [#37](https://github.com/Proyecto-Houssay/frontend-odonto/issues/37) TR-22.
- Sprint 6: [#38](https://github.com/Proyecto-Houssay/frontend-odonto/issues/38) TR-23, [#39](https://github.com/Proyecto-Houssay/frontend-odonto/issues/39) TR-24, [#40](https://github.com/Proyecto-Houssay/frontend-odonto/issues/40) TR-25, [#41](https://github.com/Proyecto-Houssay/frontend-odonto/issues/41) TR-26, [#42](https://github.com/Proyecto-Houssay/frontend-odonto/issues/42) TR-27.

## Dependencias y decisiones abiertas

1. **Sprint 0/1 siguen abiertos:** cerrar solo al cumplir los criterios de sus issues; no asumir que las pantallas placeholder equivalen a módulos terminados.
2. **Autenticación:** backend issue #3 describe el login; confirmar forma exacta de identidad, roles y expiración con Swagger antes de finalizar el cliente.
3. **API vs mocks:** distinguir explícitamente modo demo de modo conectado; no presentar datos ficticios como registros reales.
4. **Ganancias y cobros:** backend issue #55 solicita esos reportes, pero el alcance backend documentado no confirma endpoints para cobros. TR-26 registra la decisión pendiente.
5. **Odontograma:** tratarlo como académico/demostrativo hasta contar con contrato de persistencia clínica validado.
6. **Planificación:** responsables, capacidad, puntos y fechas se definen en la reunión del equipo; aquí no se asignaron arbitrariamente.

## Definition of Done

- Criterios de aceptación verificados.
- Integración con contratos backend actuales y errores visibles.
- Sin credenciales/tokens ni datos mock confundibles con datos reales.
- Estados carga/vacío/error/éxito contemplados.
- Pruebas relevantes registradas.
- Cambios integrados por Pull Request a develop y issue actualizado.
