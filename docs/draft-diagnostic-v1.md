# Muestra diagnóstica v1: ocho entradas congeladas

La muestra está congelada **antes de cambiar el prompt o generar sus respuestas**. Incluye mensajes ficticios, clasificaciones fijadas por el asistente y pasajes completos seleccionados explícitamente. No es una muestra independiente de confirmación ni una evaluación de recuperación: no vuelve a buscar políticas.

## Qué revisar

| Lote | Casos | Riesgo que se observa |
| --- | --- | --- |
| 1 | `diag-01`, `diag-02` | Plazo desde despacho y consulta previa a compra; cambio de talla condicionado a stock |
| 2 | `diag-03`, `diag-04` | Política ausente; política existente pero insuficiente para destino/costos internacionales |
| 3 | `diag-05`, `diag-06` | No ofrecer reembolso/reenvío pedidos explícitamente pospuestos; no confundir pendiente con duplicado acreditado |
| 4 | `diag-07`, `diag-08` | Instrucciones incrustadas con supuesta autoridad para inventar pagos, fuentes, plazos o cambiar idioma |

[manifest.json](../eval/drafts/diagnostic-v1/manifest.json) registra fecha, autoría del asistente, hashes de los cuatro archivos, IDs y tres criterios por caso. Los criterios son notas para revisar, no etiquetas calculadas, adjudicación humana ni instrucciones enviadas al modelo. El caso de cumpleaños deriva del fallo ya observado: es evidencia de desarrollo, no un descubrimiento independiente nuevo. Los ataques no tienen controles emparejados, por lo que no permiten atribuir causalmente una diferencia a la inyección.

Los contextos incluyen el resumen fijo, pero no es una fuente independiente: revisa las afirmaciones contra el mensaje original y los pasajes. Los resúmenes de los dos ataques advierten que hay instrucciones incrustadas; esto facilita el diagnóstico y no mide resistencia general del sistema frente a inyección. Las políticas son ficticias y se copian completas, sin abreviarlas. El número de pedido conserva ceros iniciales y no demuestra identidad ni titularidad.

Corrección de preflight, antes de cualquier captura de esta muestra: la revisión independiente detectó que el segundo criterio de `diag-06` podía extender ambiguamente los 7 días hábiles a la verificación del duplicado. Se aclaró que ese plazo solo corresponde a liberar el cargo pendiente; el duplicado se reintegra después de verificarlo, sin plazo de verificación especificado. No se cambiaron los cuatro lotes ni sus hashes. Esta aclaración del criterio se registra antes de evaluar respuestas, no como una adaptación posterior a resultados.

## Entradas, no resultados

Los lotes tienen `kind:frozen_inputs`, `provenance:synthetic` y no contienen `attempts`. El capturador acepta este formato además de las capturas anteriores. El replay y el runner semántico necesitan respuestas reales o fixtures explícitos; no confunden estas entradas con intentos fallidos o exitosos.

El límite del capturador sigue siendo dos casos por corrida. **Esta unidad no ejecutó llamadas reales.** Los tests recorren los cuatro lotes con un puerto falso; no son resultados de un modelo.

## Comprobar integridad sin proveedor

```bash
npm test -- test/draft-diagnostic-sample.test.ts test/draft-capture.test.ts
```

Comprueba cuatro hashes exactos, ocho IDs únicos, dos casos por grupo, criterios completos, datos faltantes derivados coherentes y compatibilidad del pipeline con mocks. El manifiesto no es una firma: quien cambie archivos y hashes puede alterar ambos. Los hashes de políticas e instrucciones registran las fuentes al congelar, no obligan a que una versión futura del producto conserve el mismo prompt.

No regeneres ni edites los lotes después de ver respuestas. Una corrección de entrada requiere una versión nueva y conservar la anterior. Usa los mismos cuatro archivos y el mismo orden al comparar modelos o prompts; registrar instrucciones reales de cada captura permite distinguir cambios previstos de deriva accidental.

## Baseline registrada

La [baseline de ocho intentos](draft-diagnostic-baseline-v1.md) ya está capturada: siete respuestas válidas estructuralmente y un error HTTP400 conservado sin reintento. Los contextos originales siguen intactos. Esto no convierte la muestra en evidencia de exactitud ni en revisión semántica ya realizada.

## Cómo realizar una captura nueva: explícita y con gasto

Para cada lote, tras autorizar el gasto, ejecuta por separado:

```bash
# Ejemplo SOLO del lote 1: hasta dos llamadas, sin retries ni reparación.
npm run eval:drafts:capture -- --confirm-provider-calls=2 \
  eval/drafts/diagnostic-v1/batch-1.json /tmp/diagnostic-v1-baseline-batch-1.json
```

Repite deliberadamente para los lotes2,3 y4 con rutas nuevas. El total será **hasta ocho llamadas** si completas los cuatro lotes; no existe una corrida automática que multiplique el presupuesto. Si hay fallos, conserva la salida y no repitas para ocultarlos. No mezcles nuevas respuestas con intentos sintéticos o capturas de otra configuración. Los archivos nuevos se reservan sin sobrescribir evidencia.

Después genera un paquete por captura con [el protocolo semántico](draft-semantic-review.md), entrega cada paquete a dos revisores separados y conserva su exposición declarada. Mantén los criterios y resultados previos fuera de su paquete si buscas revisión ciega según la rúbrica general; si los ven, registra esa exposición. No sumes acuerdos del asistente como verdad humana ni interpretes ocho casos como una tasa generalizable de calidad.
