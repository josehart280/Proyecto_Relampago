// Obtén el formulario y el botón
const loginForm = document.getElementById('loginForm');
const submitButton = document.getElementById('submitButton');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Lógica de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = e.target.login.value;
    const password = e.target.password.value;

    // Limpiar errores previos
    errorMessage.classList.add('hidden');

    // Hacer la solicitud POST a la ruta /login
    const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            login: login, 
            passUsuario: password,
            isEmail: false // Indicamos que no estamos enviando un correo, sino un ID
        })
    });

    const data = await response.json();

    // Si el login es exitoso
    if (response.ok) {
        // Mostrar mensaje de éxito
        errorMessage.classList.remove('hidden');
        errorText.innerText = 'Login exitoso. Redirigiendo...';  // Mensaje de éxito
        setTimeout(() => {
            // Redirige dependiendo del rol
            if (data.message.includes('Estudiante')) {
                window.location.href = '/estudiante.html';  // Redirigir a estudiantes.html
            } else if (data.message.includes('Administrador')) {
                window.location.href = '/administrador.html';  // Redirigir a administrador.html
            } else if (data.message.includes('Aprobador')) {
                window.location.href = '/aprobador.html';  // Redirigir a aprobador.html
            }
        }, 2000);  // Redirige después de 2 segundos
    } else {
        // Mostrar mensaje de error
        errorMessage.classList.remove('hidden');
        errorText.innerText = data.message;  // Mostrar mensaje de error (Credenciales incorrectas)
    }
});
