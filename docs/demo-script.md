# Guion de demo: 3 minutos

Objetivo: mostrar un operador que conserva el control de la IA, no una ejecución autónoma. El guion presupone dependencias instaladas, servidor local iniciado y datos preparados; no incluye ese tiempo ni garantiza latencia del proveedor. No requiere grabar video.

## Preparación

- Sigue el [inicio rápido](../README.md#quick-start) con una base aislada. No expongas el servidor: no tiene autenticación.
- Añade dos mensajes ficticios: «Quiero devolver el pedido 64132.» y «El pedido 64132 llegó ayer. Quería consultar cómo devolverlo.»
- Elige **Clasificar** una sola vez; procesa toda la bandeja nueva y consume tokens. Revisa ambos resultados antes de presentar. Si corriges campos para preparar la demo, dilo: no es una medición de calidad.
- En el primero, genera como máximo un borrador y deja visible el resultado para presentarlo. No hay garantía de fidelidad ni de éxito; no repitas llamadas para conseguir una respuesta perfecta.
- Para mostrar plazos por vencer/vencidos con una importación nueva, usa CSV con `receivedAt` ISO y fechas relativas a tu hora de presentación, según los objetivos de [SLA](sla.md). Los timestamps estáticos envejecen; no prometas que el CSV original mostrará los tres estados.
- Ten abiertas las [capturas etiquetadas](images/README.md) como alternativa sin proveedor. Son datos y respuestas simulados: decláralo y no los presentes como una llamada real.

## Recorrido cronometrado

| Tiempo | Acción | Qué decir |
| --- | --- | --- |
| 0:00–0:20 | Mostrar bandeja | «InboxOps ayuda a priorizar, revisar y redactar. La IA propone; la persona decide. No envía mensajes ni cambia pedidos». |
| 0:20–0:45 | Señalar orden y filtro SLA | «El vencimiento es determinista y mide revisión humana, no respuesta enviada. Facturación 4 h, envíos 8 h y devoluciones/otros 24 h; sin clasificación es provisional». |
| 0:45–1:15 | Abrir el primer mensaje y comparar con su clasificación | «El código calcula los datos faltantes. Este pedido pide devolución, pero falta el motivo. Que el número aparezca no acredita un pedido real ni su titularidad». |
| 1:15–1:50 | Leer borrador preparado, frase y fuente; editar una palabra | «Generar es una acción explícita que consume tokens. Las fuentes permiten contrastar, pero una fuente real puede estar mal aplicada. Solo se edita y copia: no se envía». |
| 1:50–2:15 | Abrir relacionada, confirmar descarte y volver | «Coincide el número de la clasificación actual. No fusionamos tickets ni inferimos identidad. Navegar no llama al modelo; el aviso evita perder una edición por sorpresa». |
| 2:15–2:40 | Mostrar clasificación y aceptar solo si es correcta, o corregir | «Guardamos la decisión humana; el SLA termina al revisar. Los borradores son efímeros y lo descartado al navegar no se recupera». |
| 2:40–3:00 | Abrir caso técnico y tabla de evidencia | «Hay tests deterministas y corridas reales archivadas con fallos. En el holdout histórico se plantó un pedido y se invirtió un resumen; las revisiones posteriores asistidas no son ground truth humano». |

## Si algo falla

- Si no hay borrador preparado, muestra [la captura](images/reply-sources.png) y explica que es simulada. No prometas completar una llamada dentro del guion.
- Si triage falla, muestra el estado fallido y la clasificación manual; no ocultes ni provoques la falla.
- Si no coinciden los números, muestra las clasificaciones actuales y explica la limitación; corregir para ilustrar la navegación debe anunciarse como preparación ficticia.
- Si no hay conexión al proveedor, presenta las imágenes y el [caso técnico](case-study.md). No hay modo de modelo offline en la app.

## Cierre para entrevista

«La parte importante no es que el modelo siempre acierte: es separar reglas deterministas de generación, hacer visibles los errores y permitir revisión humana. Antes de producción faltan autenticación, verificación de pedidos, validación con personas y una muestra independiente nueva».
