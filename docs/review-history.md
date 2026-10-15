# Historial de revisión guardada

Abre una solicitud revisada para ver **Historial de revisión**: la decisión persistida, su fecha y una comparación entre la sugerencia original y la clasificación final humana.

## Qué muestra

| Dato | Comportamiento |
| --- | --- |
| Decisión | Aceptación de sugerencia, corrección humana o clasificación manual, tal como fue guardada |
| Fecha | `review.reviewedAt`, mostrada en la zona horaria del navegador |
| Campos | Categoría, número de pedido y motivo de devolución; además, datos faltantes derivados por el dominio |
| Comparación | Valor original y final; etiqueta «Modificado» o «Sin cambios». Se conservan ceros iniciales y texto exacto. Los datos faltantes se comparan como conjunto. |
| Resumen | Original del modelo, identificado como no editable en la revisión; no hay resumen final humano persistido |

Si se guardó una corrección sin diferencias en los campos comparados, la acción sigue siendo «Corrección humana», pero no se inventan cambios. En una clasificación manual sin sugerencia se muestran los valores finales y la ausencia del original; no se cuentan como correcciones de una propuesta inexistente. Si hay un error de triage guardado, también se muestra.

## Límites

El dominio actual permite una sola revisión por solicitud. Esta vista **no es un registro de auditoría completo**: no guarda versiones sucesivas, intentos de clasificación, borradores de respuesta, fecha de generación del modelo ni identidad del operador. No hay usuarios autenticados.

La comparación usa los datos ya persistidos y cargados por la API; no cambia contratos ni el esquema de SQLite, no genera eventos retroactivos y no llama al modelo. Las solicitudes sin revisar no muestran historial. La revisión no implica que se haya enviado una respuesta ni verifica la verdad del resumen o la titularidad del pedido.
