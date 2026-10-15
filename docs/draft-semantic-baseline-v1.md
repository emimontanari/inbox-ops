# Revisiones semánticas AI de la baseline v1

Dos sesiones separadas de revisión AI coincidieron en sus etiquetas sobre las siete respuestas válidas estructuralmente. **El acuerdo no demuestra que las etiquetas sean correctas ni que los revisores sean independientes.** El intento fallido sigue visible y no se convirtió en respuesta evaluable.

## Evidencia

- [Baseline original](draft-diagnostic-baseline-v1.md): ocho intentos sin retries, siete respuestas y un error HTTP400 (`diag-06`). No se volvió a generar ninguna respuesta para esta revisión.
- [Protocolo registrado](../eval/drafts/diagnostic-v1/semantic-protocol-v1.md): acceso solicitado sólo a la rúbrica y cuatro paquetes, sin modelo del generador, criterios específicos por caso, observaciones del padre ni otra revisión.
- Revisiones admitidas: [semantic-a.json](../eval/drafts/diagnostic-v1/semantic-a.json), [semantic-b.json](../eval/drafts/diagnostic-v1/semantic-b.json).
- [Resumen](../eval/drafts/diagnostic-v1/semantic-summary.json) y reportes completos: [1](../eval/drafts/diagnostic-v1/semantic-report-1.json), [2](../eval/drafts/diagnostic-v1/semantic-report-2.json), [3](../eval/drafts/diagnostic-v1/semantic-report-3.json), [4](../eval/drafts/diagnostic-v1/semantic-report-4.json).

Cada reporte conserva ambas razones, etiquetas y pasajes declarados. Se validaron hashes de paquete, IDs, cobertura de respuestas/frases, existencia de pasajes y presencia de citas. Esa validación no comprueba la verdad de las razones.

## Qué acordaron — no una tasa de exactitud

| Dimensión | Etiquetas coincidentes |
| --- | --- |
| Respaldo por frase | 11 `supported`, 7 `unsupported`, 3 `not_applicable` |
| Citas por frase | 9 `applicable`, 4 `misapplied`, 8 `none` |
| Abstención por respuesta | 3 `not_needed`, 4 `inappropriate` |

Se revisaron21frases en7respuestas. Hubo cero dimensiones con etiquetas diferentes; no es un porcentaje de calidad. El error de formato de `diag-06` permanece en `excluded` del lote3, con uso desconocido en el replay.

Los juicios señalan promesas de seguimiento no respaldadas en los casos sin política, uso de una rama de seguimiento para otra situación y la promesa de notificar una factura. No se corrigió el prompt ni se emitió ninguna de esas respuestas a clientes.

## Acuerdo con errores compartidos posibles

En `diag-02`, ambos marcaron como respaldada la frase «Cambios de talla no tienen costo, pero están sujetos al stock disponible», sin objetar la omisión de **una vez por pedido** presente en la fuente. Esa limitación ya había sido señalada por el asistente padre antes de recibir las revisiones. La coincidencia de los revisores no resuelve esa observación ni la convierte en irrelevante.

Ambos también consideran aplicable la frase condicional sobre48horas sin novedades dentro de una consulta por entrega marcada como recibida. La fidelidad literal de una condición no garantiza su relevancia en el caso; la distinción merece revisión humana o una rúbrica posterior más específica. Estas observaciones no se inyectaron en los votos: se preservan las etiquetas tal como se entregaron.

El prompt baseline instruye anunciar que una persona revisará y responderá cuando falte evidencia, a la vez que restringe promesas de seguimiento fuera de políticas. Los revisores no recibieron ese prompt: evaluaron el respaldo en mensaje y pasajes, no la obediencia a instrucciones del sistema. Su resultado no permite atribuir esos fallos sólo al modelo.

## Procedencia y corrección de formato

Ambos usaron el perfil `gentle-ai-verify` en contextos separados y declararon `kind:ai`, `exposure:blind`; modelo y esfuerzo de ejecución quedaron `unknown`. No se garantiza diversidad de modelos, autenticidad del cegamiento ni independencia estadística. El padre, ya expuesto a resultados previos, no se presentó como revisor ciego. Son juicios asistidos por IA, no adjudicación humana.

La salida original de A tenía cierres JSON incorrectos. Se conservó en [semantic-a-original.txt](../eval/drafts/diagnostic-v1/semantic-a-original.txt) y se solicitó sólo corregir la serialización, sin compartir votos de B ni reconsiderar juicios. La [salida corregida](../eval/drafts/diagnostic-v1/semantic-a-corrected.txt) pasó JSON y se comprobó que todos los tokens de cadena —incluidos etiquetas, razones, evidencia y hashes— eran idénticos al original. B se conserva en [semantic-b-original.txt](../eval/drafts/diagnostic-v1/semantic-b-original.txt). No se repararon votos manualmente ni se suprimió el primer resultado.

Estas revisiones consumieron ejecución del modelo del harness, incluida la corrección de formato. No hubo nuevas llamadas Groq del producto; no se dispone de un consumo total medido para los revisores y no se reporta como cero.

## Reproducir sin nuevas llamadas

Los archivos `semantic-a.json` y `semantic-b.json` agrupan cuatro revisiones, una por paquete. Para ejecutar el CLI, extrae la revisión correspondiente a cada lote:

```bash
node --input-type=module -e 'import fs from "node:fs"; for (const id of ["a","b"]) { const data=JSON.parse(fs.readFileSync(`eval/drafts/diagnostic-v1/semantic-${id}.json`,"utf8")); data.reviews.forEach((review,i)=>fs.writeFileSync(`/tmp/semantic-${id}-${i+1}.json`,JSON.stringify(review))); }'
npm run --silent eval:drafts:semantic -- report eval/drafts/diagnostic-v1/baseline-1.json /tmp/semantic-a-1.json /tmp/semantic-b-1.json > /tmp/semantic-report-1.json
```

Repite el comando de reporte para lotes2,3 y4. Un código0 significa que las revisiones cumplieron el contrato, no que las respuestas sean correctas. El CLI conserva el error excluido del lote3 y no realiza llamadas.

## Siguiente paso

Antes de optimizar el prompt, aclarar el tratamiento de condiciones omitidas y relevancia de citas, sin reetiquetar retroactivamente estos reportes. Para una rúbrica revisada, registrar versión y juicios nuevos, mantener esta baseline y comparar entradas idénticas. Una revisión humana puede resolver las ambigüedades; el acuerdo AI actual no la sustituye. No hubo commit ni push en esta unidad.
