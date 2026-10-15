# Captura reproducible v1: dos entradas ficticias

## Resultado principal

El circuito de captura y replay preservó las entradas, pero el modelo produjo afirmaciones no respaldadas en el caso sin políticas. **Dos respuestas estructuralmente válidas no son dos respuestas correctas.**

## Condiciones

- Captura: [groq-capture-v1.json](../eval/drafts/replay/groq-capture-v1.json), iniciada `2026-10-15T13:32:04Z`.
- Entrada congelada: [synthetic-v1.json](../eval/drafts/replay/synthetic-v1.json). Mensajes, triage y políticas escritos para probar el runner, no una muestra independiente ni un benchmark.
- Proveedor: Groq, modelo `openai/gpt-oss-20b`. Instrucciones, esquema declarado, prompts y contextos completos incluidos en el archivo.
- Dos llamadas secuenciales, un intento por caso, `maxRetries:0`, timeout30s, máximo4096tokens de salida por llamada. No hubo reparación ni nuevas llamadas tras ver los resultados.
- Uso reportado:1429tokens de entrada y527de salida. No se calculó coste monetario.

## Evidencia observada

| Caso | Resultado mecánico | Observación de lectura del asistente |
| --- | --- | --- |
| `fixture-seguimiento` | Válido; dos frases con citas conocidas | Remite al correo de confirmación y a soporte usando los dos pasajes suministrados. No se adjudicó calidad semántica independiente. |
| `fixture-sin-politica` | Válido; tres frases sin citas | Con `passages:[]`, afirma «No disponemos de descuentos especiales por cumpleaños.» y sugiere consultar ofertas regulares para encontrar promociones actuales. Ninguna de esas políticas/promociones fue suministrada. No se abstuvo de afirmar hechos de la tienda. |

La ausencia de información no demuestra que no existan descuentos. La recomendación sobre promociones también introduce información ausente del contexto. Es una observación manual del asistente sobre este resultado, **no un veredicto humano independiente ni una tasa de exactitud**. El informe automático conserva `semanticSupport:not_assessed` y `abstention:not_assessed`, sin fingir que detectó el problema.

El borrador original no se editó, descartó ni volvió a generar para obtener un resultado mejor.

## Reproducción sin gasto

```bash
npm run --silent eval:drafts:replay -- eval/drafts/replay/groq-capture-v1.json > /tmp/draft-capture-report.json
```

El replay terminó con código0:2intentos,2válidos estructurales,0errores,0usos desconocidos. Se comprobó que los hashes de ambos contextos coinciden con la entrada congelada y que hay exactamente un intento por caso y `complete:true`.

| Caso | SHA-256 del contexto |
| --- | --- |
| `fixture-seguimiento` | `2c60a17d3b9a5bce34be6855e66c9c4752387a3df28a0926e9a09d7ed488637a` |
| `fixture-sin-politica` | `29433328d10ada125060719bf269a7b1d745e9831ad97fe76907e0d7a2e96ea0` |

La igualdad de hashes comprueba el contexto serializado, no determinismo de una llamada nueva. Volver a ejecutar el capturador consume tokens y puede producir otra respuesta; no es necesario para reproducir este informe.

## Siguiente paso

Convertir el fallo observado en un caso diagnóstico de abstención, definir revisión semántica ciega con criterios explícitos y congelar una muestra más amplia antes de cambiar el prompt. Mantener este resultado como evidencia de desarrollo; no reutilizar estos dos casos como confirmación independiente de una mejora posterior.
