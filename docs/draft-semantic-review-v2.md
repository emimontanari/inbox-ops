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

## Ejecutar sin llamadas al proveedor

```bash
npm run --silent eval:drafts:semantic -- packet eval/drafts/diagnostic-v1/baseline-1.json --rubric=draft-semantic-v2 > /tmp/packet-v2-1.json
# Dos revisores separados completan revisiones NUEVAS ligadas a ese packetHash.
npm run --silent eval:drafts:semantic -- report eval/drafts/diagnostic-v1/baseline-1.json /tmp/review-v2-a-1.json /tmp/review-v2-b-1.json --rubric=draft-semantic-v2 > /tmp/report-v2-1.json
```

Sin flag se mantiene v1 para reproducir reportes existentes. El hash de captura es idéntico, pero cambiar la versión de rúbrica cambia el hash de paquete: los votos v1 se rechazan al intentar reunirlos como v2. El motor sólo valida y reúne juicios; seleccionar v2 **no clasifica ni corrige textos automáticamente**.

## Candidato del prompt

El prompt candidato elimina la orden de prometer revisión y respuesta humana cuando no haya evidencia. Ahora pide reconocer información insuficiente sin inferir políticas existentes o inexistentes ni asegurar contactos, notificaciones o acciones agendadas. También explicita conservar condiciones materiales y dirigirse al cliente de tú.

Los tests comprueban que esas instrucciones llegan al modelo simulado; no demuestran obediencia de un modelo real. El adaptador de producción mantiene su recuperación previa de claves rechazadas; el transporte de evaluación sigue sin reparar ni reintentar. No se alteró la baseline ni sus instrucciones archivadas.

## Comparación final acotada

1. Mantener los cuatro lotes y su orden exactos. Registrar el hash del prompt candidato; el hash baseline del manifiesto permanece histórico y no se sustituye.
2. Usar el mismo proveedor/modelo/configuración y hasta ocho llamadas nuevas, sin reintentos, sólo tras confirmar el gasto. Conservar errores y uso desconocido.
3. Aplicar v2 tanto a baseline como a candidato con juicios nuevos; no comparar etiquetas v1 antiguas con etiquetas v2 como si sólo hubiera cambiado el prompt. Conservar las versiones anteriores.
4. Registrar el cegamiento real. Para comparación emparejada ciega hace falta un orden aleatorizado y clave separada; los paquetes actuales no hacen esa asignación y no deben presentarse como experimento ciego A/B.
5. Reportar ejemplos, desacuerdos, fallos y consumo; no una tasa de exactitud generalizable. Son ocho casos de desarrollo ya conocidos.

La preparación original no ejecutó nuevas capturas ni juicios v2. Después, con autorización explícita para ocho llamadas, se realizó la [comparación final](draft-final-comparison-v2.md), conservando errores, juicios nuevos de ambas variantes y límites de los evaluadores. La mejora de abstención es localizada, sin victoria global validada.

Se cierra esta iteración de InboxOps sin abrir una cadena indefinida de ajustes de rúbrica. La comparación no autoriza por sí sola publicación.
