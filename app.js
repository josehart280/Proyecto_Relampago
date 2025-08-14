const express = require('express');
const path = require('path');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();

// Configuración CORS
const cors = require('cors');
app.use(cors());

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src')));

// Conexión a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: process.env.DB_CONNECTION_LIMIT,
});

// Función para ejecutar consultas SQL
function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Login
function loginUsuario(idUsuario, passUsuario, callback) {
  const sql = 'CALL login_usuario(?, ?)';
  pool.query(sql, [idUsuario, passUsuario], (err, results) => {
    if (err) {
      console.error('Error al ejecutar el procedimiento almacenado:', err);
      return callback(err, null);
    }
    callback(null, results[0][0].resultado);
  });
}

app.post('/login', (req, res) => {
  const { login, passUsuario } = req.body;
  loginUsuario(login, passUsuario, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Hubo un error en el login' });
    }
    if (result.includes('Redirigiendo')) {
      res.json({ message: result });
    } else {
      res.status(401).json({ message: result });
    }
  });
});

// Endpoints para el dashboard administrativo

// Obtener todas las solicitudes
app.get('/api/solicitudes', async (req, res) => {
  try {
    const { estado, search } = req.query;
   
    let sql = `
      SELECT s.*, u.nombre, u.apellido1, u.apellido2, u.cedula, u.telefono, u.email, u.direccion,
             e.notaPromedio, e.Beca
      FROM solicitudes s
      JOIN estudiantes e ON s.idEstudiante = e.idEstudiante
      JOIN usuarios u ON e.idEstudiante = u.idUsuario
    `;
   
    const params = [];
   
    if (estado) {
      sql += ' WHERE s.estado = ?';
      params.push(estado);
    }
   
    if (search) {
      sql += estado ? ' AND ' : ' WHERE ';
      sql += '(u.nombre LIKE ? OR u.apellido1 LIKE ? OR u.apellido2 LIKE ? OR u.cedula LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
   
    sql += ' ORDER BY s.fechaSolicitud DESC';
   
    const solicitudes = await executeQuery(sql, params);
   
    // Obtener documentos para cada solicitud
    for (const solicitud of solicitudes) {
      const documentos = await executeQuery(
        'SELECT tipoDocumento FROM documentos WHERE idSolicitud = ?',
        [solicitud.idSolicitud]
      );
      solicitud.documentos = documentos.map(d => d.tipoDocumento);
     
      // Obtener grupo familiar
      const grupoFamiliar = await executeQuery(
        'SELECT * FROM grupofamiliar WHERE idEstudiante = ?',
        [solicitud.idEstudiante]
      );
      solicitud.grupoFamiliar = grupoFamiliar;
     
      // Calcular ingreso familiar total
      const ingresoFamiliar = grupoFamiliar.reduce(
        (total, miembro) => total + (miembro.ingreso_mensual || 0), 0
      );
      solicitud.ingresoFamiliar = ingresoFamiliar;
      solicitud.miembrosFamilia = grupoFamiliar.length;
    }
   
    res.json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener estadísticas de solicitudes
app.get('/api/solicitudes/estadisticas', async (req, res) => {
  try {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(estado = 'pendiente') as pendientes,
        SUM(estado = 'en-revision') as enRevision,
        SUM(estado = 'aprobada') as aprobadas,
        SUM(estado = 'rechazada') as rechazadas
      FROM solicitudes
    `;
   
    const [stats] = await executeQuery(sql);
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener detalles de una solicitud específica
app.get('/api/solicitudes/:id', async (req, res) => {
  try {
    const { id } = req.params;
   
    const [solicitud] = await executeQuery(`
      SELECT s.*, u.nombre, u.apellido1, u.apellido2, u.cedula, u.telefono, u.email, u.direccion,
             e.notaPromedio, e.Beca
      FROM solicitudes s
      JOIN estudiantes e ON s.idEstudiante = e.idEstudiante
      JOIN usuarios u ON e.idEstudiante = u.idUsuario
      WHERE s.idSolicitud = ?
    `, [id]);
   
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
   
    // Obtener documentos
    const documentos = await executeQuery(
      'SELECT tipoDocumento FROM documentos WHERE idSolicitud = ?',
      [id]
    );
    solicitud.documentos = documentos.map(d => d.tipoDocumento);
   
    // Obtener grupo familiar
    const grupoFamiliar = await executeQuery(
      'SELECT * FROM grupofamiliar WHERE idEstudiante = ?',
      [solicitud.idEstudiante]
    );
    solicitud.grupoFamiliar = grupoFamiliar;
   
    // Calcular ingreso familiar
    const ingresoFamiliar = grupoFamiliar.reduce(
      (total, miembro) => total + (miembro.ingreso_mensual || 0), 0
    );
    solicitud.ingresoFamiliar = ingresoFamiliar;
    solicitud.miembrosFamilia = grupoFamiliar.length;
   
    res.json(solicitud);
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
});

// Actualizar estado de una solicitud
app.put('/api/solicitudes/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, montoAprobado, motivoDecision } = req.body;
   
    // Validar estado
    if (!['pendiente', 'en-revision', 'aprobada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
   
    // Validar monto si es aprobada
    if (estado === 'aprobada' && (!montoAprobado || isNaN(montoAprobado))) {
      return res.status(400).json({ error: 'Monto aprobado requerido y debe ser numérico' });
    }
   
    // Validar motivo si es rechazada
    if (estado === 'rechazada' && !motivoDecision) {
      return res.status(400).json({ error: 'Motivo de decisión requerido para rechazo' });
    }
   
    const updateData = {
      estado,
      fechaDecision: estado === 'aprobada' || estado === 'rechazada' ? new Date() : null,
      montoAprobado: estado === 'aprobada' ? montoAprobado : null,
      motivoDecision: estado === 'rechazada' || estado === 'aprobada' ? motivoDecision : null
    };
   
    await executeQuery(
      'UPDATE solicitudes SET ? WHERE idSolicitud = ?',
      [updateData, id]
    );
   
    res.json({ message: 'Estado de solicitud actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Crear una beca para un estudiante
app.post('/api/becas', async (req, res) => {
  try {
    const { idEstudiante, monto, plazo } = req.body;
   
    if (!idEstudiante || !monto || !plazo) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
   
    // Verificar si el estudiante ya tiene una beca
    const [existente] = await executeQuery(
      'SELECT * FROM becas WHERE idEstudiante = ?',
      [idEstudiante]
    );
   
    if (existente) {
      return res.status(400).json({ error: 'El estudiante ya tiene una beca asignada' });
    }
   
    // Crear la beca
    await executeQuery(
      'INSERT INTO becas (idEstudiante, nombre, monto, plazo) VALUES (?, ?, ?, ?)',
      [idEstudiante, 'Beca Socioeconómica', monto, plazo]
    );
   
    // Actualizar estado del estudiante
    await executeQuery(
      'UPDATE estudiantes SET Beca = 1 WHERE idEstudiante = ?',
      [idEstudiante]
    );
   
    res.json({ message: 'Beca creada exitosamente' });
  } catch (error) {
    console.error('Error al crear beca:', error);
    res.status(500).json({ error: 'Error al crear beca' });
  }
});

module.exports = app;
