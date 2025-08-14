const sql = require('mssql');
require('dotenv').config(); // Para cargar las variables de entorno desde el archivo .env

// Configuración de la conexión a la base de datos
const config = {
  user: process.env.DB_USER,         // Usuario de la base de datos
  password: process.env.DB_PASSWORD, // Contraseña de la base de datos
  server: process.env.DB_HOST,       // Host de la base de datos
  database: process.env.DB_DATABASE, // Nombre de la base de datos
  port: parseInt(process.env.DB_PORT), // Puerto de la base de datos (default: 1433)
  options: {
    encrypt: true, // Necesario para bases de datos en la nube
    trustServerCertificate: true // Para evitar advertencias de seguridad
  }
};

// Función para realizar la conexión
async function connectToDatabase() {
  try {
    // Conexión a SQL Server
    await sql.connect(config);
    console.log("Conexión a la base de datos exitosa.");
  } catch (err) {
    console.error("Error al conectar a la base de datos:", err);
  }
}

// Función para cerrar la conexión
async function closeConnection() {
  try {
    await sql.close();
    console.log("Conexión cerrada.");
  } catch (err) {
    console.error("Error al cerrar la conexión:", err);
  }
}

// Exportar la conexión y funciones
module.exports = {
  sql,
  connectToDatabase,
  closeConnection
};
