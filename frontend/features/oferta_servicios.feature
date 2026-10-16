# language: es
Característica: Oferta de servicios del trabajador
  Como trabajador autenticado
  Quiero administrar servicios, tarifas y horarios en una sola sección
  Para que mis clientes sepan qué ofrezco y cuándo puedo atenderles

  Antecedentes:
    Dado que soy un trabajador autenticado

  Escenario: Configurar precio y horario de un servicio
    Cuando abro mi oferta y contenido
    Entonces debo poder configurar la tarifa y el horario de cada servicio
    Cuando guardo un servicio con su precio y horario
    Entonces la tarifa y el horario deben guardarse junto con el servicio
