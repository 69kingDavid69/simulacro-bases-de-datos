# Guía de Adaptación: SaludPlus API

Esta guía explica paso a paso cómo puedes reutilizar y adaptar este backend para conectarlo a otras bases de datos (tanto en MySQL como en MongoDB) y cómo procesar nuevos o distintos archivos CSV.

## 0. Requisitos Previos e Instalación (Setup)
Antes de adaptar el código, asegúrate de tener el proyecto listo para ejecutarse en tu nuevo entorno.

1. **Instalar Node.js:** Asegúrate de tener Node.js instalado en tu computadora.
2. **Instalar Dependencias:** Abre tu terminal, navega a la carpeta del proyecto (`saludplus-api`) y ejecuta:
   ```bash
   npm install
   ```
3. **Crear Archivo de Entorno (`.env`):** Si acabas de clonar o copiar el proyecto, crea un archivo llamado `.env` en la raíz del proyecto (junto a `package.json`). Puedes usar el siguiente esquema base:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=tu_base_de_datos
   MONGO_URI=mongodb://localhost:27017/tu_base_mongo
   ```
4. **Iniciar el Servidor:** Una vez configurado, puedes levantar la API ejecutando:
   ```bash
   node index.js
   ```

---

## 1. Cambiar la Conexión a la Base de Datos

El proyecto está diseñado para funcionar con **MySQL** (como base relacional principal) y **MongoDB** (como base documental para historial extendido).

### Para MySQL (`config/db.mysql.js`):
Si vas a utilizar otra base de datos MySQL (por ejemplo, en otro servidor o con otro nombre de base de datos), puedes modificar los valores de conexión editando las variables de entorno en tu archivo `.env`:

```env
DB_HOST=tu_nuevo_host
DB_USER=tu_nuevo_usuario
DB_PASSWORD=tu_nueva_contraseña
DB_NAME=tu_nueva_base_de_datos
```

Alternativamente, puedes editar los valores por defecto directamente en el archivo `config/db.mysql.js`:
```javascript
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'tu_nuevo_host',
    // ...
});
```

### Para MongoDB (`config/db.mongo.js`):
Si quieres cambiar la base de datos de MongoDB a la que se conecta la aplicación, edita la variable `MONGO_URI` en tu archivo `.env`:

```env
MONGO_URI=mongodb://localhost:27017/tu_nueva_base_de_datos_mongo
```

O modifícalo directamente en `config/db.mongo.js`:
```javascript
const connectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/tu_nueva_base_de_datos';
```

---

## 2. Adaptar la Lógica CRUD para Nuevas Tablas

Si tu nueva base de datos MySQL tiene tablas diferentes o columnas diferentes, deberás ajustar las consultas SQL en el controlador principal.

### Archivo a editar: `controllers/apiController.js`

1. **Crear un registro (`createDoctor`):** Encontrarás un bloque comentado que te indica cómo hacer el insert.
   Cambia el query de `INSERT INTO doctors...` a `INSERT INTO tu_nueva_tabla...`.
2. **Obtener registros (`getDoctors`, `getDoctorById`):** Modifica los `SELECT * FROM doctors` hacia tus nuevas tablas y actualiza las propiedades de los objetos de respuesta según las nuevas columnas devueltas.
3. **Actualizar un registro (`updateDoctor`):** Modifica el `UPDATE` para que modifique los campos que tu nueva tabla requiera.
4. **Eliminar un registro (`deleteDoctor`):** Cambia el `DELETE FROM doctors` para que borre desde `tu_nueva_tabla`.

---

## 3. Adaptar la Importación de Nuevos Archivos CSV

Si necesitas cargar un archivo `.csv` con columnas distintas o insertar esa información en una base de datos con una estructura diferente, deberás modificar la lógica del archivo de importación.

### Archivo a editar: `controllers/importController.js`

El controlador de importación recorre el archivo CSV, normaliza la información en memoria usando diccionarios (`Map`) y luego hace las inserciones.

**Paso 3.1: Mapeo Inicial del CSV**
Dentro de la lectura del CSV (`for (const row of results)`), debes adaptar la lectura de las columnas:

```javascript
// AQUI ADAPTAS LOS MAPAS
miNuevaTablaMap.set(row.columna_unica_csv, {
    campo1: row.columna1_csv,
    campo2: row.columna2_csv
});
```

**Paso 3.2: Inserciones en MySQL**
Más abajo, dentro de la transacción (`connection.beginTransaction()`), cambia los bucles `for` para que hagan `INSERT` a tus nuevas tablas iterando sobre tus nuevos Mapas:

```javascript
for (const item of miNuevaTablaMap.values()) {
    await connection.query(
        'INSERT INTO mi_nueva_tabla (campo1, campo2) VALUES (?, ?)',
        [item.campo1, item.campo2]
    );
}
```

**Paso 3.3: Mapeo y Upserts en MongoDB**
Si también guardas parte del reporte en MongoDB, cambia el modelo y el objeto de estructura que se guarda en `mongoHistories`. Luego, en la sección de `=== MONGODB UPSERT ===`, ajusta los `$set` y validaciones para que coincidan con la nueva colección o esquema (por ejemplo en lugar de actualizar `PatientHistory`, podrías actualizar un nuevo modelo de Mongoose que hayas creado en `/models`).

---

## 4. Adaptar el Frontend (`index.html`)

El frontend de prueba usa HTML y JavaScript puro. Si has adaptado el backend para consultar y crear otra cosa que no sea "Doctores", necesitarás cambiar los nombres de los campos de entrada (`inputs`) y cómo JavaScript forma el objeto de datos que enviará a la API.

### Archivo a editar: `index.html`

1. **Cambiar los encabezados visuales (`<h2>`):** Cambia textos como "Create Doctor" o "Update/Delete Doctor" a lo que corresponda en el entorno final (ej: "Crear Producto").
2. **Modificar los Inputs (`<input>`):** En los formularios `createForm` y `updateForm`, cambia los `id` o añade nuevos `<input>` para que cubran todos los campos de tu nueva tabla en MySQL.
3. **Ajustar el cuerpo de la petición (JS):** En la sección del `<script>`, dentro de los *event listeners* del `createForm` y `updateForm`, verás cómo se toma el valor de esos campos (`document.getElementById(...)`). Edita el objeto `body: JSON.stringify({...})` para que los nombres de sus propiedades (`name`, `email`, etc) ahora coincidan con los que el controlador `apiController.js` está esperando de tu nueva tabla.

## Resumen

- Modifica `.env` y la carpeta `config/` para cambiar donde guarda y lee los datos el backend.
- Modifica `controllers/apiController.js` para adaptar la interfaz directa CRUD (GET, POST, PUT, DELETE).
- Modifica `controllers/importController.js` para decirle al backend cómo leer las nuevas columnas del CSV y en qué tablas insertar la data por lotes.
- Modifica `index.html` cambiando los `id` de los `<inputs>` y los `JSON.stringify` en el JS para que reciba y envíe a la API la información estructural de tu nueva tabla.
