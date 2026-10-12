# Lista de tareas (Express + MongoDB)

API REST para gestionar una lista de tareas (crear, listar, marcar como completada y borrar), con una pequeña interfaz web incluida. El backend está hecho con **Node.js + Express 5** y los datos se guardan en **MongoDB**.

> Proyecto con fines exclusivamente educativos. No tiene usuarios ni autenticación.

---

## Nivel y objetivos de aprendizaje

**Nivel:** inicial–intermedio.

Al dockerizar esta aplicación vas a practicar:

- Escribir un `Dockerfile` para **Node.js** usando el *lockfile* (`package-lock.json`) para instalaciones reproducibles.
- Instalar **solo dependencias de producción**.
- Usar el usuario sin privilegios que ya trae la imagen oficial de Node.
- Manejar correctamente las **señales** (`SIGTERM`) para un apagado limpio.
- Conectar la app a una base de datos **NoSQL** mediante una **cadena de conexión** en una variable de entorno.
- Persistir los datos de MongoDB con un **volumen**.
- Entender por qué una app que **falla al arrancar** necesita una **política de reinicio** o un **healthcheck** en su dependencia.

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Entorno de ejecución | Node.js 20.19 o superior (recomendado: LTS actual) |
| Framework web | Express 5 |
| Base de datos | MongoDB 7 u 8 |
| Driver | `mongodb` (driver oficial de Node.js) |
| Módulos | ES Modules (`"type": "module"`) |
| Interfaz | HTML + JavaScript sin frameworks en `public/` |

---

## Arquitectura

```
 Navegador ──HTTP──▶  api (Node.js + Express, puerto 3000)
                         │   ├─ sirve /public (HTML estático)
                         │   └─ expone /api/tareas
                         │
                         │  TCP 27017 (protocolo MongoDB)
                         ▼
                       mongo (base de datos documental)
                         └─ base "tareas_db", colección "tareas"
```

Ejemplo de documento guardado en la colección `tareas`:

```json
{
  "_id": "665f1c2e9b1e8a0012345678",
  "titulo": "Escribir un Dockerfile",
  "completada": false,
  "creadaEn": "2026-01-01T12:00:00.000Z"
}
```

MongoDB crea la base de datos y la colección automáticamente la primera vez que se inserta un documento; **no hace falta ningún script de inicialización**.

---

## Estructura del proyecto

```
03-tareas-express-mongodb/
├── server.js           # Servidor Express: rutas, conexión a Mongo y apagado limpio
├── package.json        # Metadatos, scripts y dependencias
├── package-lock.json   # Versiones exactas de todo el árbol de dependencias
├── public/
│   └── index.html      # Interfaz web que consume la API
├── README.md
└── CHANGELOG.md
```

Detalles importantes:

- **`server.js`**
  - Se conecta a MongoDB **antes** de empezar a escuchar. Si no puede conectarse en ~5 segundos, **termina con código 1**. Esto es intencional: en Docker conviene que un proceso que no puede funcionar se detenga y deje que el orquestador decida qué hacer.
  - Escucha `SIGINT` y `SIGTERM` para cerrar el servidor HTTP y la conexión a Mongo de forma ordenada. Si el proceso no recibe estas señales (por ejemplo, porque lo lanzaste a través de un *shell* o de `npm`), Docker esperará el tiempo de gracia y luego lo matará a la fuerza.
  - `express.static('public')` usa una **ruta relativa**: el directorio de trabajo del proceso importa.
- **`package.json`**: el script `start` arranca el servidor; el script `dev` usa el modo `--watch` de Node para recargar al editar.
- **`package-lock.json`**: permite instalar exactamente las mismas versiones en cualquier máquina. Existe un comando de npm pensado para entornos automatizados que instala **solo** a partir del lockfile y falla si no coincide con `package.json`.

---

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP de la API. |
| `MONGO_URL` | `mongodb://localhost:27017` | Cadena de conexión a MongoDB. Formato: `mongodb://[usuario:clave@]host:puerto`. |
| `DB_NAME` | `tareas_db` | Nombre de la base de datos. |
| `NODE_ENV` | (sin definir) | Pon `production` en la imagen final; muchas librerías (incluida Express) se optimizan con este valor. |

---

## API

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `GET` | `/` | — | Interfaz web. |
| `GET` | `/health` | — | `200` si Mongo responde, `503` si no. |
| `GET` | `/api/tareas` | — | Arreglo de tareas (más recientes primero). |
| `POST` | `/api/tareas` | `{"titulo": "texto"}` | `201` con la tarea creada; `400` si falta el título. |
| `PATCH` | `/api/tareas/:id` | `{"completada": true}` | `200` con la tarea actualizada; `400`/`404` en error. |
| `DELETE` | `/api/tareas/:id` | — | `204` si se borró; `404` si no existe. |

---

## Ejecución local sin Docker (referencia)

1. Necesitas Node.js y un servidor MongoDB local.
2. Instala dependencias con npm (a partir del lockfile).
3. Arranca con el script `start` (o `dev` para recarga automática).

---

## Reto: dockerizar la aplicación

> Pistas, no soluciones.

### Parte 1: el `Dockerfile`

1. **Imagen base:** imagen oficial de Node con una versión **LTS** explícita. Compara las variantes `alpine`, `slim` y la completa.
2. **Directorio de trabajo:** defínelo; recuerda que la app busca `public/` de forma relativa.
3. **Caché de dependencias:** copia primero `package.json` **y** `package-lock.json`, instala, y luego copia el código.
4. **Instalación reproducible y de producción:** investiga el comando de npm que usa estrictamente el lockfile y la opción para **omitir** dependencias de desarrollo.
5. **`NODE_ENV`:** defínelo como `production` dentro de la imagen.
6. **Usuario:** la imagen oficial de Node ya incluye un usuario sin privilegios. Averigua su nombre y úsalo. Ojo con el **dueño** de los archivos que copias.
7. **Arranque y señales:** arranca el proceso de Node **directamente** en forma *exec*. Investiga por qué arrancar con `npm start` puede impedir que `SIGTERM` llegue a tu app, y qué hace la opción `--init` de Docker (o el campo `init` en Compose).
8. **`.dockerignore`:** imprescindible excluir `node_modules` local. ¿Por qué podría romper la imagen si se copia? (pista: binarios nativos y sistemas operativos distintos).

### Parte 2: el `docker-compose.yml`

1. Dos servicios: la **API** (construida desde tu `Dockerfile`) y **MongoDB** (imagen oficial, versión explícita).
2. Pasa `MONGO_URL` a la API usando el **nombre del servicio** de Mongo como host.
3. Crea un **volumen con nombre** para los datos de Mongo. Investiga en qué ruta guarda sus datos la imagen oficial.
4. Agrega un **healthcheck** a Mongo. Pista: la imagen oficial incluye un *shell* de Mongo capaz de ejecutar un comando `ping`.
5. Haz que la API espere a que Mongo esté **sana** antes de arrancar.
6. Agrega una **política de reinicio** a la API. Prueba a quitar el `depends_on` y observa cómo la API se cae y se recupera sola.
7. Publica solo el puerto de la API.
8. (Opcional) Activa la **autenticación** de Mongo usando las variables de entorno de usuario *root* que documenta la imagen oficial, y ajusta `MONGO_URL` para incluir credenciales. **Nunca** subas credenciales reales a un repositorio: usa un archivo `.env` ignorado por git.

### Criterios de aceptación

- [ ] La interfaz web permite crear, completar y borrar tareas.
- [ ] Las tareas **persisten** tras recrear los contenedores.
- [ ] La imagen **no** contiene dependencias de desarrollo ni el `node_modules` de tu máquina.
- [ ] El proceso de Node **no** corre como `root`.
- [ ] Al detener el entorno, en los logs aparece `Recibida SIGTERM, cerrando...` y el contenedor se detiene en **menos de 10 segundos**.
- [ ] MongoDB **no** está publicado hacia tu máquina.

### Retos extra

- Agrega un servicio **Mongo Express** (interfaz web para Mongo) y conéctalo a tu base de datos.
- Crea un `compose.override.yml` de desarrollo que monte el código y use el script `dev`. Pista: investiga el patrón del **volumen anónimo** para que `node_modules` del contenedor no sea tapado por el *bind mount*.
- Prueba la función **Compose Watch** para sincronizar cambios sin *bind mounts*.
- Agrega un healthcheck a la API. Ten en cuenta qué herramientas existen (o no) en la imagen `alpine`.

---

## Errores comunes

| Síntoma | Causa probable |
|---|---|
| `No se pudo conectar a MongoDB en mongodb://localhost:27017` | No definiste `MONGO_URL` o usaste `localhost`. |
| La instalación falla diciendo que el lockfile no está sincronizado | No copiaste `package-lock.json` o fue modificado a mano. |
| `Cannot find module 'express'` | Copiaste el código encima de `node_modules`, o lo excluiste del lugar equivocado. |
| El contenedor tarda 10 s en detenerse | El proceso no recibe `SIGTERM` (lo lanzaste vía *shell* o `npm`). |
| `EACCES: permission denied` | Los archivos pertenecen a `root` y la app corre con otro usuario. |

---

## Referencias

- Imagen oficial de Node.js: <https://hub.docker.com/_/node>
- Buenas prácticas de Node.js en Docker: <https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md>
- Imagen oficial de MongoDB: <https://hub.docker.com/_/mongo>
- Comandos de npm: <https://docs.npmjs.com/cli/commands>
- Healthchecks en Compose: <https://docs.docker.com/reference/compose-file/services/#healthcheck>
- Compose Watch: <https://docs.docker.com/compose/how-tos/file-watch/>
