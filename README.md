# 🌊 Brisas Marinas

**Plataforma web para la gestión de ventas, inventario y reportes del Restaurante Brisas Marinas.**

Proyecto académico desarrollado para la asignatura *Formulación y Evaluación de Proyecto* — Universidad Cooperativa de Colombia, sede Montería.

**Autoras:** María Alejandra Pineda Godín · Shaira Jimena Julio Marzán

---

## 📋 Tabla de contenido

1. [Stack tecnológico](#stack-tecnológico)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Requisitos previos](#requisitos-previos)
4. [Instalación paso a paso](#instalación-paso-a-paso)
5. [Ejecución](#ejecución)
6. [Credenciales por defecto](#credenciales-por-defecto)
7. [Roles y permisos](#roles-y-permisos)
8. [API REST](#api-rest)
9. [Solución de problemas](#solución-de-problemas)

---

## 🛠️ Stack tecnológico

| Capa          | Tecnología                                               |
|---------------|----------------------------------------------------------|
| Backend       | Node.js 18+, Express 4                                   |
| Base de datos | PostgreSQL 13+                                           |
| Frontend      | HTML5, CSS3, JavaScript (vanilla)                        |
| Autenticación | JWT (JSON Web Tokens) + bcrypt                           |
| Gráficos      | Chart.js 4 (vía CDN)                                     |
| Seguridad     | helmet, CORS, rate-limit, express-validator              |

---

## 📁 Estructura del proyecto

```
brisas-marinas/
├── backend/                      # API REST en Node.js + Express
│   ├── database/                 # Scripts SQL y seeders
│   │   ├── schema.sql            # Estructura de la base de datos
│   │   ├── seed.sql              # Categorías y productos de ejemplo
│   │   ├── seed-users.js         # Crea usuarios con bcrypt
│   │   ├── init-db.js            # Crea la BD si no existe
│   │   └── run-sql.js            # Ejecuta archivos SQL
│   ├── src/
│   │   ├── config/database.js    # Pool de conexiones PostgreSQL
│   │   ├── controllers/          # Lógica de cada módulo
│   │   ├── middlewares/          # auth, errorHandler, validate
│   │   ├── routes/               # Definición de endpoints
│   │   └── app.js                # Configuración de Express
│   ├── .env.example              # Variables de entorno (plantilla)
│   ├── package.json
│   └── server.js                 # Punto de entrada
│
└── frontend/                     # Aplicación web (HTML/CSS/JS)
    ├── assets/
    │   ├── css/                  # styles.css, login.css, pos.css
    │   └── js/                   # api.js, utils.js, auth.js + módulos
    ├── pages/                    # dashboard, sales, inventory, reports, users
    └── index.html                # Pantalla de login
```

---

## ✅ Requisitos previos

- **Node.js** 18 o superior — [nodejs.org](https://nodejs.org/)
- **PostgreSQL** 13 o superior — [postgresql.org](https://www.postgresql.org/)
- **npm** (incluido con Node.js)

Verificar instalación:
```bash
node --version       # debe mostrar v18.0.0 o superior
npm --version
psql --version
```

---

## 🚀 Instalación paso a paso

### 1) Clonar / descomprimir el proyecto

Si recibiste el ZIP, descomprímelo. Si es repositorio git:
```bash
git clone <url-del-repo> brisas-marinas
cd brisas-marinas
```

### 2) Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3) Configurar variables de entorno

Copia el archivo de ejemplo y ajusta los valores:
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de PostgreSQL:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brisas_marinas
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

JWT_SECRET=una-clave-aleatoria-larga-y-segura
```

### 4) Crear y poblar la base de datos

Ejecuta los siguientes comandos en orden:

```bash
# 4.1 Crea la base de datos "brisas_marinas"
npm run db:create

# 4.2 Crea las tablas y vistas
npm run db:schema

# 4.3 Inserta categorías y productos de ejemplo
npm run db:seed

# 4.4 Crea los usuarios iniciales con contraseñas hasheadas
npm run db:seed-users
```

> 💡 También puedes ejecutar **`npm run db:reset`** para hacer los pasos 4.2, 4.3 y 4.4 de una vez (recrea todo desde cero).

---

## ▶️ Ejecución

### Modo desarrollo

Desde la carpeta `backend/`:
```bash
npm run dev
```

Esto levanta el servidor con `nodemon` en `http://localhost:3000`.

### Modo producción

```bash
npm start
```

### Acceso a la aplicación

El backend sirve el frontend automáticamente. Abre en tu navegador:

```
http://localhost:3000
```

Te llevará a la pantalla de login. También puedes acceder al frontend de manera independiente con cualquier servidor estático (por ejemplo *Live Server* de VS Code), apuntando a la carpeta `frontend/`.

---

## 🔐 Credenciales por defecto

Después de ejecutar `npm run db:seed-users` quedan creados los siguientes usuarios. **Contraseña inicial para los tres: `admin123`**.

| Usuario      | Rol            | Nombre                       |
|--------------|----------------|------------------------------|
| `admin`      | administrador  | Baldura María Petro Pérez    |
| `cajero1`    | cajero         | María José Cajero            |
| `empleado1`  | empleado       | Pedro Empleado               |

> ⚠️ **IMPORTANTE:** cambia estas contraseñas tras el primer ingreso (módulo Usuarios → ícono 🔑).

---

## 👥 Roles y permisos

| Módulo / Acción                 | Administrador | Cajero | Empleado |
|---------------------------------|:-------------:|:------:|:--------:|
| Iniciar sesión                  | ✅            | ✅     | ✅       |
| Ver dashboard con KPIs          | ✅            | —      | —        |
| Registrar ventas                | ✅            | ✅     | ✅       |
| Consultar ventas                | ✅            | ✅     | —        |
| Anular ventas                   | ✅            | —      | —        |
| Consultar inventario            | ✅            | ✅     | ✅       |
| Crear/editar productos          | ✅            | —      | —        |
| Ajustar stock                   | ✅            | —      | —        |
| Ver reportes                    | ✅            | —      | —        |
| Gestionar usuarios              | ✅            | —      | —        |

---

## 🔌 API REST

Base URL: `http://localhost:3000/api`

| Método | Endpoint                                | Descripción                            | Rol mínimo    |
|--------|-----------------------------------------|----------------------------------------|---------------|
| POST   | `/auth/login`                           | Iniciar sesión                         | público       |
| GET    | `/auth/me`                              | Datos del usuario autenticado          | autenticado   |
| POST   | `/auth/change-password`                 | Cambiar contraseña propia              | autenticado   |
| GET    | `/users`                                | Listar usuarios                        | administrador |
| POST   | `/users`                                | Crear usuario                          | administrador |
| PUT    | `/users/:id`                            | Actualizar usuario                     | administrador |
| PUT    | `/users/:id/reset-password`             | Restablecer contraseña                 | administrador |
| DELETE | `/users/:id`                            | Desactivar usuario                     | administrador |
| GET    | `/products`                             | Listar productos                       | autenticado   |
| GET    | `/products/:id`                         | Detalle de producto                    | autenticado   |
| GET    | `/products/low-stock`                   | Productos con bajo stock               | autenticado   |
| POST   | `/products`                             | Crear producto                         | administrador |
| PUT    | `/products/:id`                         | Actualizar producto                    | administrador |
| PATCH  | `/products/:id/stock`                   | Ajustar stock                          | administrador |
| DELETE | `/products/:id`                         | Desactivar producto                    | administrador |
| GET    | `/categories`                           | Listar categorías                      | autenticado   |
| POST   | `/categories`                           | Crear categoría                        | administrador |
| GET    | `/sales`                                | Listar ventas (filtros opcionales)     | admin/cajero  |
| GET    | `/sales/:id`                            | Detalle de venta con items             | admin/cajero  |
| POST   | `/sales`                                | Registrar venta nueva                  | autenticado   |
| POST   | `/sales/:id/void`                       | Anular venta (restaura stock)          | administrador |
| GET    | `/reports/summary`                      | KPIs generales                         | administrador |
| GET    | `/reports/sales-by-day`                 | Ventas por día                         | administrador |
| GET    | `/reports/top-products`                 | Productos más vendidos                 | administrador |
| GET    | `/reports/by-payment`                   | Ventas por método de pago              | administrador |
| GET    | `/reports/by-category`                  | Ventas por categoría                   | administrador |
| GET    | `/reports/by-user`                      | Ventas por cajero                      | administrador |
| GET    | `/health`                               | Healthcheck del servicio               | público       |

Todos los endpoints (excepto los públicos) requieren el header:
```
Authorization: Bearer <token>
```

---

## 🩺 Solución de problemas

**Error: `connect ECONNREFUSED 127.0.0.1:5432`**
→ PostgreSQL no está corriendo. Inícialo con `sudo service postgresql start` (Linux) o desde *Services* (Windows).

**Error: `password authentication failed for user "postgres"`**
→ Las credenciales en `.env` son incorrectas. Verifica `DB_USER` y `DB_PASSWORD`.

**Error: `database "brisas_marinas" does not exist`**
→ Ejecuta `npm run db:create` antes de `npm run db:schema`.

**El login dice "usuario o contraseña incorrectos"**
→ Verifica que ejecutaste `npm run db:seed-users`. La contraseña inicial es `admin123`.

**El frontend no carga / errores de CORS**
→ Si abres `index.html` directamente con `file://`, no funcionará. Accede vía `http://localhost:3000` (el backend sirve el frontend).

**Quiero resetear todo desde cero**
```bash
npm run db:reset
```
Esto vuelve a crear tablas, productos y usuarios.

---

## 📜 Licencia

MIT — Proyecto académico de uso libre con fines educativos.

---

*Desarrollado con ❤️ para el Restaurante Brisas Marinas — Moñitos, Córdoba, Colombia.*
