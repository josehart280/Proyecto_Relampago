const app = require('./app');  // Asegúrate de que este import esté correcto
const port = process.env.PORT || 3000;  // Puerto por defecto

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
