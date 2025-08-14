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


// Rutas API para el dashboard administrativo
app.get('/api/solicitudes', async (req, res) => {
  const { estado, search } = req.query;
  
  try {
    // Primero verifica qué columnas existen realmente en tu base de datos
    // Esta es una versión modificada que usa nombres de columnas más comunes
    let query = `SELECT 
  s.idSolicitud, s.idEstudiante, s.fechaSolicitud, s.estado, 
  s.montoAprobado, s.fechaDecision, s.motivoDecision,
  d.nombre as nombre, d.PrimerApellido as apellido1, d.SegundoApellido as apellido2,
  d.CedulaDimex as cedula, d.telefonoCelular as telefono, 
  d.correoElectronico as email, d.direccionExtra as direccion,
  e.notaPromedio as notaPromedio, 
  (SELECT SUM(ingreso_mensual) FROM ProyectoRelampago.grupofamiliar WHERE idEstudiante = s.idEstudiante) as ingresoFamiliar
FROM ProyectoRelampago.Solicitudes s
JOIN ProyectoRelampago.Estudiantes e ON s.idEstudiante = e.idEstudiante
JOIN ProyectoRelampago.datossolicitante d ON s.idEstudiante = d.idEstudiante
WHERE 1=1`;
    
    if (estado) query += ` AND s.estado = '${estado}'`;
    if (search) {
      query += ` AND (e.nombreEstudiante LIKE '%${search}%' OR e.apellidoEstudiante LIKE '%${search}%' OR e.cedulaEstudiante LIKE '%${search}%')`;
    }
    
    const result = await sql.query(query);
    
    // Obtener documentos para cada solicitud (si la tabla Documentos existe)
    const solicitudes = await Promise.all(result.recordset.map(async (solicitud) => {
      let documentos = [];
      try {
        const docs = await sql.query`SELECT nombreDocumento FROM ProyectoRelampago.Documentos WHERE idSolicitud = ${solicitud.idSolicitud}`;
        documentos = docs.recordset.map(d => d.nombreDocumento);
      } catch (e) {
        console.log("Tabla Documentos no encontrada o error al consultar");
      }
      
      let grupoFamiliar = [];
      try {
        const familiares = await sql.query`SELECT * FROM ProyectoRelampago.GrupoFamiliar WHERE idEstudiante = ${solicitud.idEstudiante}`;
        grupoFamiliar = familiares.recordset;
      } catch (e) {
        console.log("Tabla GrupoFamiliar no encontrada o error al consultar");
      }
      
      return {
        ...solicitud,
        documentos,
        grupoFamiliar,
        miembrosFamilia: grupoFamiliar.length // Calculado dinámicamente
      };
    }));
    
    res.json(solicitudes);
  } catch (err) {
    console.error("Error al obtener solicitudes:", err);
    res.status(500).json({ message: 'Error al obtener solicitudes' });
  }
});

app.get('/api/solicitudes/estadisticas', async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'en-revision' THEN 1 ELSE 0 END) as enRevision,
        SUM(CASE WHEN estado = 'aprobada' THEN 1 ELSE 0 END) as aprobadas,
        SUM(CASE WHEN estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas
      FROM Solicitudes
    `);
    
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error al obtener estadísticas:", err);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

app.get('/api/solicitudes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Consulta principal (existente)
    const result = await sql.query`
      SELECT 
        s.idSolicitud, s.idEstudiante, s.estado, s.fechaSolicitud, s.fechaDecision, 
        s.montoAprobado, s.motivoDecision,
        d.nombre, d.PrimerApellido as apellido1, d.SegundoApellido as apellido2,
        d.CedulaDimex as cedula, d.telefonoCelular as telefono,
        d.correoElectronico as email, d.direccionExtra as direccion,
        e.notaPromedio
      FROM ProyectoRelampago.solicitudes s
      JOIN ProyectoRelampago.datossolicitante d ON s.idEstudiante = d.idEstudiante
      JOIN ProyectoRelampago.estudiantes e ON s.idEstudiante = e.idEstudiante
      WHERE s.idSolicitud = ${parseInt(id)}
    `;
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    
    const solicitud = result.recordset[0];
    
    // Obtener información de la beca si la solicitud está aprobada
    let becaInfo = null;
    if (solicitud.estado === 'aprobada') {
      const becaResult = await sql.query`
        SELECT plazo, fechaAsignacion, fechaVencimiento 
        FROM ProyectoRelampago.becas 
        WHERE idEstudiante = ${solicitud.idEstudiante}
        ORDER BY fechaAsignacion DESC
      `;
      becaInfo = becaResult.recordset[0] || null;
    }
    
    // Resto del código existente (documentos, grupo familiar, etc.)
    
    res.json({
      ...solicitud,
      documentos: docs.recordset.map(d => d.nombreDocumento),
      grupoFamiliar: familiares.recordset,
      miembrosFamilia: familiares.recordset.length,
      ingresoFamiliar: ingresoFamiliar,
      beca: becaInfo // Agregamos la información de la beca
    });
    
  } catch (err) {
    console.error("Error al obtener solicitud:", err);
    res.status(500).json({ message: 'Error al obtener solicitud' });
  }
});

app.put('/api/solicitudes/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, montoAprobado, motivoDecision } = req.body;
    
    await sql.query`
      UPDATE Solicitudes 
      SET 
        estado = ${estado},
        montoAprobado = ${montoAprobado},
        motivoDecision = ${motivoDecision},
        fechaDecision = GETDATE()
      WHERE idSolicitud = ${id}
    `;
    
    res.json({ message: 'Estado actualizado correctamente' });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ message: 'Error al actualizar estado' });
  }
});

app.post('/api/becas', async (req, res) => {
  try {
    const { idEstudiante, monto, plazoMeses } = req.body;
    
    // Validar datos de entrada
    if (!idEstudiante || !monto || !plazoMeses) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Calcular fecha de vencimiento
    const fechaAsignacion = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + parseInt(plazoMeses));
    
    await sql.query`
      INSERT INTO ProyectoRelampago.becas 
        (idEstudiante, monto, plazo, fechaAsignacion, fechaVencimiento, estado)
      VALUES 
        (${parseInt(idEstudiante)}, ${parseFloat(monto)}, ${parseInt(plazoMeses)}, 
        ${fechaAsignacion.toISOString()}, ${fechaVencimiento.toISOString()}, 'activa')
    `;
    
    res.json({ 
      message: 'Beca creada exitosamente',
      fechaVencimiento: fechaVencimiento.toISOString().split('T')[0]
    });
  } catch (err) {
    console.error("Error al crear beca:", err);
    res.status(500).json({ message: 'Error al crear beca' });
  }
});



app.post('/getSolicitudes', async (req, res) => {
  const { idEstudiante } = req.body;
 
  try {
    const result = await sql.query`
      EXEC [ProyectoRelampago].[getEstadoSolicitudes] @idEstudiante=${idEstudiante}
    `;
 
    if (result.recordset && result.recordset.length > 0) {
      res.status(200).json({
        message: 'Solicitudes encontradas',
        data: result.recordset,
      });
    } else {
      res.status(404).json({
        message: 'No se encontraron solicitudes para este estudiante.',
      });
    }
  } catch (err) {
    console.error('Error al ejecutar el procedimiento:', err);
    res.status(500).json({
      message: 'Hubo un error al obtener las solicitudes.',
      error: err.message,
    });
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