# Revisar respaldo, citas y abstención sin inventar exactitud

Este protocolo recoge **juicios declarados** sobre respuestas concretas. El reporte valida cobertura y reúne acuerdos; no decide la verdad, no certifica independencia y no sustituye revisión humana.

## Camino rápido — sin llamadas al proveedor

```bash
npm run --silent eval:drafts:semantic -- packet eval/drafts/replay/groq-capture-v1.json > /tmp/draft-packet.json
# Entrega solo el paquete y esta rúbrica a dos revisores separados.
# Cada uno guarda su propia revisión JSON, sin ver la del otro.
npm run --silent eval:drafts:semantic -- report \
  eval/drafts/replay/groq-capture-v1.json /tmp/revision-a.json /tmp/revision-b.json > /tmp/semantic-report.json
```

No carga `.env`, no llama a modelos y no cambia el prompt. Los comandos imprimen JSON. Salida0 significa que el paquete o las revisiones tienen contrato válido, **no que las respuestas sean correctas**; salida2 indica error de archivo, contrato o vinculación.

## Qué recibe cada revisor

El paquete incluye el mensaje, triage fijo, pasajes completos ordenados y frases originales con sus citas. Los IDs de respuesta son neutros: `response-1-1` significa primer caso, primer intento. Omite modelo, tiempos, uso, IDs originales y observaciones previas del asistente. No aleatoriza el orden ni blinda a alguien que ya vio los resultados.

`captureHash` vincula toda la captura validada y `packetHash` el paquete de esta versión de rúbrica. Un cambio de respuesta, contexto o metadata de captura exige una revisión nueva. Los hashes no firman la evidencia ni verifican quién revisó.

Solo se revisan intentos estructuralmente válidos; el paquete mantiene los demás en `excluded`, con resultado mecánico. No se eliminan errores del denominador silenciosamente: el reporte semántico no calcula un porcentaje global. Una captura marcada incompleta o con cobertura distinta de la planeada se rechaza. Los errores se inspeccionan por separado con el replay.

## Rúbrica v1

Juzga el texto **según este mensaje y estos pasajes**, no por conocimiento externo ni por coincidencia de palabras. Un resumen del modelo no es una fuente independiente: contrástalo con el mensaje original. La falta de una política no prueba que la tienda no la tenga.

| Dimensión | Etiquetas | Criterio |
| --- | --- | --- |
| `support` por frase | `supported` | Todas las afirmaciones verificables están respaldadas por el mensaje o pasajes aplicables; no añade promesas, condiciones o hechos. |
| | `unsupported` | Al menos una afirmación introduce, contradice o exagera información no respaldada. En una frase mixta basta una afirmación problemática. |
| | `not_applicable` | No hace afirmaciones verificables: saludo, agradecimiento o pregunta sin premisas inventadas. |
| | `uncertain` | El contexto o la redacción no permiten decidir con confianza. Explica por qué. |
| `citations` por frase | `applicable` | Las citas existentes respaldan lo que se afirma y sus condiciones aplican al caso. Un ID real no basta. |
| | `misapplied` | Alguna cita no respalda la afirmación o aplica a otra situación. |
| | `none` | La frase no tiene citas. Esto no implica por sí solo falta de respaldo. |
| | `uncertain` | Hay citas, pero no se puede determinar su aplicabilidad. |
| `abstention` por respuesta | `appropriate` | No hay información suficiente y lo reconoce sin inventar política, plazo, coste o acción garantizada. |
| | `inappropriate` | Asegura hechos sin base en vez de reconocer la falta de información, o se abstiene pese a existir información suficiente aplicable. |
| | `not_needed` | El contexto permite responder sin abstención; la respuesta no depende de información ausente. |
| | `uncertain` | No se puede resolver de forma fiable con este contexto. |

Ejemplos de desarrollo, **no etiquetas automáticas**: «No hay descuentos» con pasajes vacíos no se deduce de la ausencia de política. «Hola» puede ser no aplicable y sin citas. Una cita sobre devoluciones no respalda un plazo de envío. «Te notificaremos mañana» requiere respaldo explícito y no debe presentarse como una acción ya realizada.

Por cada frase aporta `rationale` no vacío y `evidenceIds` con pasajes relevantes, si los hay. Para una afirmación del mensaje o una ausencia de evidencia, explica el fragmento o la ausencia en la razón; `evidenceIds` puede estar vacío. Los IDs deben existir en el contexto: el validador no verifica que la razón sea correcta. Para abstención también se exige razón.

## Formato de cada revisión

```json
{
  "packetHash": "<copiar los 64 caracteres del paquete>",
  "reviewer": { "id": "revisor-a", "kind": "human", "exposure": "blind" },
  "responses": [
    {
      "responseId": "response-1-1",
      "abstention": { "label": "uncertain", "rationale": "Explica el criterio aplicado." },
      "sentences": [
        { "index": 0, "support": "uncertain", "citations": "uncertain", "rationale": "Explica la evidencia o duda.", "evidenceIds": [] }
      ]
    }
  ]
}
```

Es una plantilla parcial, no una revisión lista para usar. Completa **todas las respuestas y todas las frases**, con índices desde0 y sin duplicados. Si no hay citas, `citations` debe ser `none`; si las hay, no puede ser `none`. El CLI exige exactamente dos revisores con IDs declarados distintos.

`kind` distingue `human` y `ai`; `exposure` distingue `blind` y `unblinded`. Son declaraciones, no autenticación. Si revisa un modelo, registra su identidad/configuración en el registro del experimento y no lo llames adjudicación humana. Si vio el modelo, resultados previos u otra revisión, debe declarar `unblinded`. Dos IDs distintos no demuestran dos personas, modelos o juicios independientes.

## Interpretar el reporte

Conserva ambas revisiones completas, razones y evidencia. Para cada dimensión: acuerdo exacto conserva la etiqueta; desacuerdo produce `uncertain`. Si ambos ya dijeron `uncertain`, sigue incierto sin contarse como desacuerdo. `disagreements` cuenta dimensiones distintas, no errores ni casos independientes.

No mezcla resultados previos del replay ni los convierte en calidad automática. Tampoco autentica un procedimiento ciego: entrega los paquetes por separado y conserva cómo se hicieron las revisiones. Antes de evaluar, congela muestra, rúbrica y protocolo; si cambias la rúbrica después de ver resultados, registra una versión nueva.

## Estado y siguiente paso

El motor y los tests de desacuerdo están listos. Los juicios sintéticos usados en tests **no son revisiones reales de la captura**. Generar un paquete no significa que ya haya sido revisado. La observación previa sobre descuentos sigue siendo una lectura no ciega del asistente, no consenso independiente.

Ya está congelada [la muestra diagnóstica de ocho entradas](draft-diagnostic-v1.md), dividida en cuatro lotes de dos sin respuestas inventadas. Siguiente unidad: capturar deliberadamente sus respuestas y asignar revisiones separadas con esta rúbrica antes de cambiar el prompt. Mantener [la captura v1](draft-capture-v1.md) como evidencia de desarrollo, no confirmación independiente de una mejora posterior.
