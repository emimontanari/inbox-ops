# Evaluación reproducible de borradores: replay offline

## Ejecutar sin proveedor

```bash
npm run eval:drafts:replay -- eval/drafts/replay/synthetic-v1.json
```

El comando no carga `.env`, importa adaptadores ni hace llamadas de IA. Imprime un informe JSON determinista. Para guardarlo sin el encabezado de npm:

```bash
npm run --silent eval:drafts:replay -- eval/drafts/replay/synthetic-v1.json > /tmp/draft-report.json
```

La muestra incluida tiene **dos casos sintéticos escritos para probar el runner**. Ni los textos ni las respuestas son generaciones de un modelo; no son un baseline, un benchmark o evidencia de calidad. Tampoco se presentan como adjudicación humana independiente. No modifica tickets ni SQLite.

## Qué queda congelado

Cada caso contiene `id`, `context` y `attempts`. El contexto guarda mensaje, categoría, resumen opcional, datos extraídos, datos faltantes y **todos los pasajes suministrados, en orden**, aunque el borrador no los cite. No vuelve a clasificar ni recuperar pasajes al reproducir. El SHA-256 `contextHash` usa claves ordenadas y conserva el orden de arrays; permite comprobar igualdad de entradas, no autenticidad ni calidad.

Cada intento registra `status: returned` con `output` original o `status: error` con su error. Se conservan todos los intentos, incluidos fallos anteriores a un éxito. El runner no reintenta ni repara claves o formato. Un archivo incompleto no prueba que no existieron otros intentos fuera de él.

`provenance` distingue `synthetic` y `provider_capture`: es una declaración del archivo, no una certificación. No se fabrican contextos completos a partir de los resultados antiguos que no los registraron.

## Interpretar el informe

- `valid` significa formato correcto y validación de dominio: texto no vacío, longitud admitida y citas conocidas. **No demuestra respaldo semántico**.
- Errores: `invalid_format`, `empty_draft`, `draft_too_long`, `unknown_source` o `error` del proveedor registrado.
- `uncitedSentences` cuenta frases no vacías sin citas. Pueden ser saludos, preguntas o afirmaciones sin respaldo: no se etiquetan automáticamente como errores.
- `semanticSupport` y `abstention` son `not_assessed`. Un borrador vacío es inválido, no una abstención correcta. La revisión semántica y los desacuerdos requieren un protocolo separado.
- `usage` es `null` si no está disponible o no puede validarse; nunca se convierte en cero. No se infiere coste del replay ni se garantiza completitud del consumo original.
- `counts` cuenta **intentos**, no casos independientes ni porcentajes de exactitud. Un caso con reintento contribuye varias veces.

Códigos de salida: `0` si todos los intentos son estructuralmente válidos; `1` si el informe contiene errores/invalidaciones (el JSON igualmente se imprime); `2` ante argumentos, archivo o contrato inválidos.

## Captura explícita con proveedor

**Consume tokens y envía los textos y pasajes a Groq.** Usa únicamente datos ficticios. Requiere `GROQ_API_KEY` en el entorno o `.env`; `GROQ_MODEL` selecciona el modelo.

```bash
npm run eval:drafts:capture -- --confirm-provider-calls=2 \
  eval/drafts/replay/synthetic-v1.json /tmp/draft-capture.json
npm run --silent eval:drafts:replay -- /tmp/draft-capture.json > /tmp/draft-capture-report.json
```

Se admiten como máximo dos casos, una llamada secuencial por caso, con `maxRetries: 0`, timeout de30s y máximo4096tokens de salida por llamada. El presupuesto incluye fallos: no se reintenta automáticamente. El archivo de salida debe ser nuevo y su directorio existir. No se sobrescribe evidencia previa. Los `attempts` del archivo de entrada no se vuelven a generar ni se mezclan: la nueva captura contiene un intento nuevo por contexto, y conserva su origen en `capture.caseOrigin`.

La captura reutiliza instrucciones, serialización del prompt y esquema del adaptador, pero **no repara salidas rechazadas**. Guarda texto crudo, prompt exacto, esquema de salida declarado, modelo, límites explícitos, fechas y latencia. Los parámetros no especificados conservan defaults del SDK/proveedor; no garantiza reproducción bit a bit del modelo ni copia del request HTTP completo. Los errores conservan categoría, statusHTTP si existe y generación rechazada cuando está disponible, no headers, credenciales ni respuestas arbitrarias del proveedor. El uso solo se registra si ambos contadores están disponibles en una respuesta satisfactoria; los errores quedan con uso desconocido.

Se guarda un checkpoint inicial y antes/después de cada llamada mediante archivo temporal y renombrado. `complete:false` y `inFlightCaseId` permiten reconocer una interrupción: ese caso puede haber consumido tokens sin respuesta guardada. Antes de gastar también se guardan `inFlightContext` y `inFlightPrompt`, para conservar la entrada exacta aunque no llegue la respuesta. No hay reanudación ni reintento automático. Si falla la persistencia, no se realizan más llamadas. Un checkpoint inicial sin casos no es aún un bundle reproducible; uno parcial con casos permite inspección, pero no representa la corrida completa. No borres los checkpoints para aparentar una corrida limpia.

La entrada incluida sigue siendo sintética incluso si una captura posterior contiene respuestas reales del proveedor. Dos casos solo comprueban el circuito, no calidad ni eficacia frente a ataques. El comando de captura usa los códigos0/1/2 del replay; con salida1 la evidencia igualmente queda guardada.

## Captura realizada

La [captura real v1](draft-capture-v1.md) conserva dos respuestas reales sobre estas entradas ficticias. Ambas pasaron validación estructural, pero el caso sin políticas afirmó hechos no respaldados. No se descartó ni reintentó ese resultado.

## Revisión semántica

El [protocolo y runner offline](draft-semantic-review.md) genera paquetes neutrales ligados a la captura y reúne dos revisiones completas, conservando desacuerdos como inciertos. No genera juicios automáticamente ni convierte consenso en verdad.

Siguiente unidad: congelar una muestra diagnóstica más amplia y asignar revisores separados antes de cambiar el prompt. No atribuir mejoras a recuperación o prompting si cambian simultáneamente las entradas, como ocurrió en el diagnóstico v3 anterior.
