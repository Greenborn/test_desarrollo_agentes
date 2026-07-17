# Agent Orchestrator

Plataforma de orquestación de agentes de IA con interfaz de chat, integración con Redmine, automatización de navegador vía Playwright, y servicios auxiliares para registro de gastos y gestión documental.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 21+ / Express 4 / Knex 3 / MariaDB 10+ |
| Frontend | Vue 3 / Vite 6 / Bootstrap 5.3 / Pinia |
| Chat IA | DeepSeek API con streaming SSE |
| Autenticación | Sesiones con cookies (api_memoria) |
| Automatización | Playwright 1.52+ |
| Encriptación | AES-256-CBC |

## Estructura

```
├── api_gestor_servicios/  # Orquestador de servicios (puerto 4250)
├── backend/               # API REST principal (puerto 4000)
├── frontend/              # SPA Vue 3 (puerto 5173)
├── playwright/            # Microservicio Playwright (puerto 4098)
├── api_memoria/           # Servicio de memoria caché (puerto 4101)
├── api_gastos/            # Registro de gastos de tokens (puerto 4100)
├── api_documental/        # Gestión documental (puerto 4099)
├── api_procesos_consola/  # Gestión de terminales/procesos (puerto 3575)
└── docs/                  # Documentación técnica
```

## Requisitos

- Node.js 21+
- MariaDB 10+ en ejecución
- Acceso `sudo` para creación de base de datos

## Puesta a punto

El orden de los pasos es obligatorio:

```bash
# 1. Crear base de datos y usuario en MariaDB
cd backend
sudo npm run setup-db

# 2. Ejecutar migraciones
npm run migrate

# 3. Poblar datos iniciales (usuario admin/admin)
npm run seed

# 4. Iniciar backend y frontend simultáneamente
npm run dev:all
```

Cada componente también puede iniciarse individualmente desde su directorio con `npm run dev`.

## Componentes individuales

| Componente | Directorio | Comando dev | Puerto |
|---|---|---|---|---|
| Gestor Servicios | `api_gestor_servicios/` | `npm run dev` | 4250 |
| Backend | `backend/` | `npm run dev` | 4000 |
| Frontend | `frontend/` | `npm run dev` | 5173 |
| Playwright | `playwright/` | `npm run setup && npm run dev` | 4098 |
| Memoria | `api_memoria/` | `npm run dev` | 4101 |
| Gastos | `api_gastos/` | `npm run dev` | 4100 |
| Documental | `api_documental/` | `npm run dev` | 4099 |
| Procesos Consola | `api_procesos_consola/` | `npm run dev` | 3575 |

## Comandos de chat

El sistema incluye más de 60 comandos accesibles desde el chat con prefijo `/`.
Ver `docs/COMANDOS.md` para la lista completa.

## Licencia

MIT — ver [LICENSE](LICENSE) y [MANIFEST.md](MANIFEST.md).
