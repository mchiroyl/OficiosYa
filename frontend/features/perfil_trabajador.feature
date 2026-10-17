# language: es
Característica: Perfil privado del trabajador
  Como trabajador autenticado
  Quiero consultar el resumen de mi perfil profesional
  Para verificar cómo se presenta mi oferta de servicios

  Antecedentes:
    Dado que soy un trabajador autenticado

  Escenario: Mostrar la información profesional completa
    Cuando abro mi perfil
    Entonces debo ver mi nombre "Johan Gómez"
    Y debo ver mi oficio "Electricista"
    Y debo ver las secciones principales del perfil
    Y debo ver el servicio "Instalación eléctrica"
    Y debo ver mi teléfono enmascarado

  Escenario: Navegar del resumen a la edición
    Cuando abro mi perfil
    Y presiono el botón "Editar perfil"
    Entonces debo llegar al formulario de edición del perfil

  Escenario: Mantener el perfil usable en un teléfono
    Dado que uso una pantalla móvil
    Cuando abro mi perfil
    Entonces el perfil no debe desbordarse horizontalmente
    Y debo ver el botón "Editar perfil"
