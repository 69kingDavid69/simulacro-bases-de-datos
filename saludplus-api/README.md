# SaludPlus API - Guía de Estudio y Documentación Arquitectónica 🚀

Este proyecto resuelve el problema de exportación de datos planos (CSV/Excel) de la clínica SaludPlus, separando la información en un modelo relacional estricto (MySQL - 3FN) y una base de datos documental (MongoDB) para consultas rápidas del historial médico.

---

## 🏗️ 1. Arquitectura del Proyecto

El proyecto sigue el patrón **MVC (Modelo, Vista, Controlador)** simplificado para APIs REST, separando claramente las responsabilidades:

*   **`index.js`:** Es el punto de entrada. Aquí arranca el servidor Express, se configuran middlewares (como `cors` y el parseo de JSON) y se ligan las rutas principales.
*   **`config/`:** Archivos dedicados exclusivamente a establecer la conexión con las bases de datos (`db.mysql.js` y `db.mongo.js`). Aislar esto permite cambiar credenciales sin tocar la lógica de negocio.
*   **`models/`:** Define la estructura de los datos para MongoDB usando Mongoose (`PatientHistory.js`).
*   **`controllers/`:** Contiene la **lógica de negocio**.
    *   `importController.js`: Maneja el algoritmo ETL (Extract, Transform, Load).
    *   `apiController.js`: Maneja las peticiones GET/PUT para doctores, reportes y pacientes.
*   **`routes/`:** Mapea las URLs (endpoints) a las funciones específicas de los controladores (`api.route.js`). Mantiene el `index.js` limpio.
*   **`uploads/`:** Carpeta volátil donde la librería `multer` guarda temporalmente el archivo CSV mientras es procesado por el ETL.

---

## 🗄️ 2. Diseño de Base de Datos relacional (MySQL) - Hasta 3FN

El objetivo de la **Tercera Forma Normal (3FN)** es eliminar las redundancias y asegurar que cada atributo no clave dependa única y exclusivamente de la clave primaria.

### El problema original:
En el requerimiento inicial, la tabla `Appointments` (Citas) tenía los campos `treatment_description` y `treatment_cost` dependiendo de `treatment_code`. Esto es una **dependencia transitiva**, ya que el costo depende del código del tratamiento, no del ID de la cita. 

### La solución implementada:
Se extrajeron los tratamientos a su propia tabla maestra:

1.  **`patients`:** `id` (PK), `name`, `email` (UNIQUE), `phone`, `address`.
2.  **`doctors`:** `id` (PK), `name`, `email` (UNIQUE), `specialty`.
3.  **`insurances`:** `id` (PK), `name` (UNIQUE), `coverage_percentage`.
4.  **`treatments`:** `id` (PK), `treatment_code` (UNIQUE), `description`, `cost`. *(¡Esta tabla asegura la 3FN!)*
5.  **`appointments`:** `id` (PK), `appointment_id` (UNIQUE), `appointment_date`, `amount_paid`... y Múltiples Claves Foráneas (`patient_id`, `doctor_id`, `insurance_id`, `treatment_id`).

---

## ⚙️ 3. El Proceso ETL (Migración de Datos) explicada a detalle

El archivo `importController.js` es el corazón del proyecto. Su misión es leer un CSV caótico y guardarlo ordenadamente.

### Reto 1: Evitar Duplicados en Entidades Padre (MySQL)
**Problema:** Si el "Dr. Carlos Ruiz" atendió a 50 pacientes, su nombre y email aparecerán 50 veces en el archivo CSV. No queremos crear 50 doctores en MySQL.
**Solución:** 
1. Usamos la estructura `Map()` de Javascript en memoria para extraer únicamente los elementos diferentes (usando el email o el nombre como "llave" del map).
2. Al insertar en base de datos, usamos la instrucción SQL `INSERT IGNORE` o `ON DUPLICATE KEY UPDATE`. Esto le dice a MySQL: *"Inserta este médico, pero si su email ya existe, solo actualízalo y no me arrojes error"*.

### Reto 2: Respetar la Integridad Referencial
**Problema:** No puedes insertar una Cita sin antes saber qué ID generó MySQL para el Paciente y el Médico de esa fila.
**Solución:** Inserción en orden jerárquico.
1. Primero insertamos Pacientes, Médicos, Seguros y Tratamientos.
2. Luego, hacemos un `SELECT` gigante de todos ellos para traer a la memoria de Node.js sus `id` generados. Los guardamos en diccionarios (objetos "Lookups").
3. Al final, iteramos por el CSV e insertamos las citas (Appointments), y usamos los diccionarios para obtener instantáneamente el `patient_id` y `doctor_id` reales (Ej: `pLookup[row.patient_email]`).

### Reto 3: Garantizar que la base de datos no se corrompa a medias
**Problema:** Si insertamos 10,000 registros y en el registro 9,999 hay un error (ej. falta una columna obligatoria), nos quedarían 9,998 registros guardados y MySQL y Mongo quedarían desincronizados.
**Solución:** **Transacciones SQL.**
Iniciamos con `await connection.beginTransaction()`. Solo cuando todas las inserciones del archivo terminen con éxito absoluto, ejecutamos `await connection.commit()`. Si algo falla (el bloque `catch`), ejecutamos `await connection.rollback()` y la base de datos desechará mágicamente todo el trabajo parcial de esa petición.

---

## 🔄 4. MongoDB: Historial de Pacientes e Idempotencia

Se decidió usar **MongoDB** como base de datos documental auxiliar para la colección `patient_histories`. 

**¿Por qué?:** En MySQL, consultar el historial de citas de un paciente implica hacer múltiples `JOIN`s pesados entre 5 tablas distintas. Guardándolo en un solo documento JSON en Mongo, la consulta es inmediata (`O(1)`).

### Diseño del Documento:
Alberga la estructura solicitada, agrupando todas las citas de un paciente dentro de un arreglo llamado `appointments`.

### La Idempotencia en el ETL:
El script debe ser **Idempotente**, lo que significa que el usuario puede subir el archivo Excel 1 vez o 1,000 veces y la base de datos debe lucir exactamente igual, sin citas repetidas.

**En MySQL:** Se logró gracias al índice UNIQUE en la columna `appointment_id` (`ON DUPLICATE KEY UPDATE...`).
**En MongoDB:** Lograr esto fue más complejo porque los arreglos anidados (Subdocumentos) tienden a duplicarse.
1. Agrupamos todas las citas por el `patientEmail`.
2. Hacemos una consulta para saber qué citas (`appointmentId`) ya existen en la base de datos de Mongo para ese paciente (`existingApptIds = new Set()`).
3. Filtramos el listado nuevo, dejando solo las citas en donde el `appointmentId` no exista previamente.
4. Usamos `$push` y un `$each` para insertar únicamente el listado filtrado.

---

## 📡 5. Endpoints y Sincronización

*   **`GET /api/doctors`**: Muestra información plana. Puede recibir `?specialty=Cardiology`.
*   **`GET /api/reports/revenue`**: Usa la función `SUM()` nativa de MySQL y la cláusula `GROUP BY i.id` para devolver el dinero agrupado velozmente.
*   **`GET /api/patients/:email/history`**: Petición que no toca MySQL; va directo a MongoDB (`PatientHistory.findOne`) resolviéndose en escasos milisegundos.
*   **`PUT /api/doctors/:id` (El Reto de la Sincronización):**
    Si modificamos el nombre de un médico en MySQL, de repente MongoDB queda desactualizado y seguirá mostrando el nombre antiguo en los historiales de los pacientes.
    *   **Solución:** Dentro de la función `updateDoctor`, detectamos si el nombre fue modificado. Si es el caso, utilizamos el poderoso operador de los arreglos en MongoDB: `arrayFilters`.
    ```javascript
    await PatientHistory.updateMany(
        { 'appointments.doctorName': nombreAntiguo },
        { $set: { 'appointments.$[elem].doctorName': nombreNuevo } },
        { arrayFilters: [{ 'elem.doctorName': nombreAntiguo }] }
    );
    ```
    Esto busca infinitos documentos y entra adentro de sus arrays, modificando solo el nombre del doctor específico en las citas específicas, sincronizando mágicamente ambos motores de bases de datos.

---

¡Éxito en el examen! 🎓 Si puedes explicar estos conceptos de 3FN, ETL Lookups, Idempotencia de Arrays y Transacciones, tendrás una calificación perfecta.
