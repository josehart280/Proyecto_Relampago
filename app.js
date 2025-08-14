const express = require('express');
const path = require('path');
const cors = require('cors'); // Importamos CORS
const { sql, connectToDatabase } = require('./db'); // Importar la conexión a la base de datos
const app = express();

// Usar CORS para permitir solicitudes desde cualquier origen
app.use(cors());  // Esto habilita CORS para todas las rutas

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src')));

// Conectar a la base de datos
connectToDatabase();

// Ruta para el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Ruta para manejar el login
app.post('/login', async (req, res) => {
  const { login, passUsuario } = req.body;

  try {
    const result = await sql.query`EXEC ProyectoRelampago.login_usuario @p_idUsuario=${login}, @p_passUsuario=${passUsuario}`;

    if (result.recordset && result.recordset.length > 0) {
      const mensaje = result.recordset[0].resultado;

      if (mensaje.includes('Redirigiendo')) {
        res.json({ message: mensaje });
      } else {
        res.status(401).json({ message: mensaje });
      }
    } else {
      res.status(401).json({ message: 'Credenciales incorrectas' });
    }
  } catch (err) {
    console.error("Error al ejecutar el procedimiento almacenado:", err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Manejo de errores simple
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
