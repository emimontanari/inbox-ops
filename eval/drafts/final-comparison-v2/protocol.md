# Comparación final: protocolo de revisión v2

## Captura

Hasta ocho llamadas candidatas autorizadas por el usuario, una por entrada congelada, cuatro corridas de dos, sin retries ni reparación. Misma configuración declarada y contextos que baseline; cambia el prompt (abstención, condiciones materiales y trato de tú). No se atribuirá una diferencia a uno solo de esos cambios ni a causalidad estable con una sola muestra de desarrollo.

## Paquetes y asignación

Se prepararon ocho paquetes `draft-semantic-v2` con cuatro capturas baseline y cuatro candidatas. Cada paquete conserva su hash exacto, mensaje, resumen fijo, pasajes ordenados y frases/citas. Modelo, metadatos operativos, variante y juicios previos no se incluyen.

Los ocho archivos se ordenaron mediante Fisher–Yates con `crypto.randomInt` y se nombraron `packet-01.json` a `packet-08.json`. La asignación se conserva en `assignment-key.json`, separada de las lecturas solicitadas a revisores. Esto aleatoriza la presentación de paquetes, **no las generaciones del proveedor ni un ensayo independiente**. La estructura y estilo pueden permitir inferencias; no garantiza cegamiento.

Ambos revisores reciben el mismo orden, sin asignación de ganadores ni preguntas de preferencia. Los IDs neutrales de respuesta se repiten entre paquetes: la unidad de vinculación es el `packetHash`. La clave sólo se usa para reunir juicios por variante después de recibirlos.

## Juicios solicitados

Dos sesiones nuevas del perfil `gentle-ai-verify`: IDs `final-semantic-a` y `final-semantic-b`. Acceso solicitado únicamente a `reviewer-rubric.md` y los ocho paquetes, sin clave, memoria, documentos de resultados, otras revisiones o fuentes originales. El padre ya vio las salidas y no es un revisor ciego.

La rúbrica extraída contiene las aclaraciones v2, etiquetas y formato de v1; v2 prevalece. Razones breves en español y evidencia por frase, abstención por respuesta. Se revisan14respuestas/42frases; dos errores visibles quedan excluidos, sin votos fabricados. Ambos runtimes pueden compartir modelo y sesgos; la separación de sesiones no demuestra independencia estadística ni verdad humana.

Guardar originales antes de validar. Correcciones de contrato, si son necesarias, se solicitan por separado y sin compartir etiquetas del otro revisor, conservando todas las versiones. Nunca reescribir votos para obtener acuerdo. Reunir con la versión v2 en el runner; desacuerdos inciertos por dimensión.

## Interpretación y cierre

Conteos mecánicos y semánticos son distintos. Los conteos por frase tampoco son exactitud por caso ni resultados generalizables. Uso conocido no incluye consumo desconocido de errores. Los costos del modelo del harness usados en revisión son distintos de las llamadas Groq del producto y no se reportan como cero si no fueron medidos.

La comparación conserva baseline, candidato, fallos, todos los juicios y sus límites. No volver a capturar para mejorar resultados ni iniciar otra ronda indefinida. No autoriza commit ni push.
