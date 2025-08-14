const express = require('express');
const path = require('path');
const mysql = require('mysql2'); // Importar mysql2
require('dotenv').config(); // Cargar las variables de entorno desde el archivo .env

const app = express();

// Usar CORS para permitir solicitudes desde cualquier origen
const cors = require('cors');
app.use(cors());

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src')));

// Crear una conexión a la base de datos usando las variables de entorno
const pool = mysql.createPool({
  host: process.env.DB_HOST,        // Host de la base de datos
  port: process.env.DB_PORT,        // Puerto de la base de datos
  user: process.env.DB_USER,        // Usuario de la base de datos
  password: process.env.DB_PASSWORD, // Contraseña de la base de datos
  database: process.env.DB_DATABASE, // Nombre de la base de datos
  connectionLimit: process.env.DB_CONNECTION_LIMIT, // Límites de conexiones al pool
});

// Función para llamar al procedimiento almacenado
function loginUsuario(idUsuario, passUsuario, callback) {
  const sql = 'CALL login_usuario(?, ?)';  // Procedimiento para ID de usuario
  pool.query(sql, [idUsuario, passUsuario], (err, results) => {
    if (err) {
      console.error('Error al ejecutar el procedimiento almacenado:', err);
      return callback(err, null);
    }
    callback(null, results[0][0].resultado); // Devolvemos el resultado del procedimiento almacenado
  });
}

// Ruta para el login
app.post('/login', (req, res) => {
  const { login, passUsuario } = req.body;

  // Llamamos al procedimiento almacenado para verificar las credenciales
  loginUsuario(login, passUsuario, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Hubo un error en el login' });
    }

    if (result.includes('Redirigiendo')) {
      res.json({ message: result }); // Si la credencial es correcta, respondemos con un mensaje de redirección
    } else {
      res.status(401).json({ message: result }); // Si el login falla, respondemos con un mensaje de error
    }
  });
});

module.exports = app; // Exportamos la instancia de Express para usarla en server.js
