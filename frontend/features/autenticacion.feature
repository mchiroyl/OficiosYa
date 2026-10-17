# language: es
Característica: Acceso seguro a OficiosYA
  Como usuario de la plataforma
  Quiero recibir validaciones claras e ingresar según mi modo
  Para utilizar solamente las funciones que me corresponden

  Escenario: Validar los campos obligatorios del inicio de sesión
    Dado que estoy en la pantalla de inicio de sesión
    Cuando intento ingresar sin completar las credenciales
    Entonces debo ver el mensaje "El correo electrónico es obligatorio."
    Y debo ver el mensaje "La contraseña es obligatoria."

  Escenario: Ingresar correctamente como trabajador
    Dado que estoy en la pantalla de inicio de sesión
    Y selecciono el modo trabajador
    Cuando ingreso con credenciales válidas
    Entonces debo entrar al panel del trabajador
    Y debo ver la opción "Perfil" en el menú
