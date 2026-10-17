# language: es
Característica: Correcciones reportadas por QA
  Como usuario de OficiosYA
  Quiero buscar por categoría, consultar perfiles claros y usar el chat en móvil
  Para completar mis tareas sin errores de validación ni problemas de presentación

  Escenario: Buscar profesionales de Electricidad
    Dado que soy un trabajador autenticado
    Cuando abro el directorio de la categoría "Electricidad"
    Entonces la búsqueda debe enviar la categoría "Electricidad" como texto sin el parámetro id_categoria
    Y la búsqueda no debe publicar tarifas ni incluir un filtro de precio

  Escenario: Buscar profesionales de Plomería
    Dado que soy un trabajador autenticado
    Cuando abro el directorio de la categoría "Plomería"
    Entonces la búsqueda debe enviar la categoría "Plomería" como texto sin el parámetro id_categoria
    Y la búsqueda no debe publicar tarifas ni incluir un filtro de precio

  Escenario: Mostrar la biografía del perfil público sin publicar tarifas
    Cuando abro el perfil público del trabajador de prueba
    Entonces debo ver la biografía legible sin los metadatos ni precios públicos

  Escenario: Ajustar mensajes largos en una pantalla móvil
    Dado que soy un trabajador autenticado
    Y que uso una pantalla móvil
    Cuando abro el chat con un mensaje continuo extenso
    Entonces el mensaje debe ajustarse al ancho disponible

  Escenario: Explicar en español el límite de carga del DPI
    Dado que soy un trabajador autenticado
    Cuando intento enviar un DPI con una imagen mayor de 8 MB
    Entonces debo ver el aviso del tamaño máximo en español

  Escenario: Explicar en español el rechazo de una tarifa negativa
    Dado que soy un trabajador autenticado
    Cuando intento guardar una tarifa negativa
    Entonces debo ver la validación de tarifa en español
