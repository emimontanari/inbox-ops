# Rúbrica de revisión draft-semantic-v2

# Rúbrica semántica v2: condiciones y aplicabilidad

Versión explícita de la [rúbrica v1](draft-semantic-review.md), motivada por ambigüedades observadas en las revisiones de desarrollo. Conserva las mismas dimensiones, etiquetas y formato JSON; cambia cómo juzgar condiciones omitidas y relevancia. **No reetiqueta ni reemplaza los reportes v1.**

## Criterios aclarados

| Dimensión | Criterio v2 |
| --- | --- |
| `support` | Todas las afirmaciones deben estar respaldadas por mensaje y pasajes. Omitir una condición material que amplía un beneficio o garantía es `unsupported`, aunque las palabras restantes aparezcan en la fuente. Si no se puede decidir si la condición es material, `uncertain` con razón. |
| `citations` | `applicable` exige respaldo y aplicabilidad a la situación concreta, no sólo fidelidad literal. Una rama destinada a otro estado del pedido es `misapplied`, aunque conserve su condición como frase hipotética, si se ofrece como respuesta al caso actual sin necesidad justificada. Si el estado relevante no puede determinarse, `uncertain`. |
| `abstention` | `appropriate` reconoce falta de información sin asegurar acciones futuras, contacto, respuesta ni plazos no respaldados. `inappropriate` incluye sustituir esa incertidumbre por una promesa no documentada o negar ayuda pese a evidencia suficiente aplicable. |

El resto de v1 sigue vigente: `not_applicable` para frases sin afirmaciones verificables; citas `none` sólo cuando la frase original no tiene IDs; incertidumbre explícita; razones por dimensión revisada y `evidenceIds` existentes. No asumir que el resumen constituye evidencia independiente ni que los datos del cliente ya fueron verificados. Una frase mixta con al menos una afirmación sin respaldo es `unsupported`.

### Ejemplos de calibración — no votos sobre la baseline

- Fuente: «un cambio gratis al año». Respuesta: «los cambios son gratis». La restricción omitida amplía el beneficio: `unsupported`; una cita a esa fuente no pasa a ser aplicable sólo por coincidir en «gratis».
- Fuente: «si todavía no salió del depósito, se modifica la dirección». Cliente: «ya fue entregado». Repetir la condición previa al despacho no responde al estado actual: `misapplied` si se ofrece como procedimiento aplicable.
- Sin información de un servicio, decir «no tengo información suficiente para confirmarlo» reconoce incertidumbre. Decir «te llamaremos esta tarde» añade acción y plazo no respaldados.

Estos ejemplos se fijan antes de nuevos juicios v2 y no deben adaptarse para conseguir un resultado. La rúbrica es de desarrollo, no validada contra adjudicación humana. Si los revisores ven resultados anteriores deben declararse `unblinded`; no presentar una continuación de la misma sesión como un juicio ciego nuevo.


## Etiquetas y formato de revisión (se conservan)

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
  "reviewer": { "id": "revisor-a", "kind": "ai", "exposure": "blind" },
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


Las aclaraciones v2 prevalecen ante cualquier ambigüedad de la descripción general anterior. No hay acceso al modelo generador, asignación de versiones ni observaciones del padre.
