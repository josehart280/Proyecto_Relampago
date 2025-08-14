// Obtén los elementos del formulario
const loginForm = document.getElementById('loginForm');

// Lógica de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = e.target.login.value;
    const password = e.target.password.value;

    // Limpiar errores previos
    errorMessage.classList.add('hidden');  // Ocultar el mensaje de error antes de enviar la solicitud

    // Hacer la solicitud POST al servidor
    const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            login: login,
            passUsuario: password,
            isEmail: false // Enviar false porque estamos usando ID de usuario en lugar de correo
        })
    });

    const data = await response.json();

    console.log("Respuesta del servidor: ", data); // Para depurar y ver lo que estamos recibiendo del servidor

    // Si el login es exitoso (status 200)
    if (response.ok) {
        // Mostrar el mensaje de éxito
        Swal.fire({
            title: 'Login Exitoso',
            text: 'Redirigiendo...',
            icon: 'success',
            confirmButtonText: 'Aceptar'
        }).then(() => {
            // Redirige dependiendo del rol
            if (data.message.includes('Estudiante')) {
                window.location.href = 'estudiante.html';  // Redirigir a estudiante.html
            } else if (data.message.includes('Administrador')) {
                window.location.href = 'administrador.html';  // Redirigir a administrador.html
            } else if (data.message.includes('Aprobador')) {
                window.location.href = 'aprobador.html';  // Redirigir a aprobador.html
            } else {
                // Si no encontramos el rol esperado
                Swal.fire({
                    title: 'Error',
                    text: 'Rol no identificado',
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
            }
        });
    } else {
        // Mostrar mensaje de error
        Swal.fire({
            title: 'Error',
            text: data.message || 'Credenciales incorrectas',
            icon: 'error',
            confirmButtonText: 'Intentar de nuevo'
        });
    }
});
