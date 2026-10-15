# Protocolo registrado: juicios AI sobre baseline v1

## Alcance

Dos sesiones separadas del perfil `gentle-ai-verify` reciben la misma rúbrica `draft-semantic-v1` y los cuatro paquetes preparados offline desde `baseline-1.json` a `baseline-4.json`. Se evalúan siete respuestas y21frases. El error `diag-06` permanece excluido del juicio semántico y visible en el replay.

## Exposición y procedencia

- IDs declarados: `semantic-a` y `semantic-b`; tipo `ai`, nunca humano.
- Acceso solicitado: exclusivamente rúbrica/formato y los cuatro paquetes. Sin documentos de resultados, capturas originales, criterios específicos del manifiesto, memoria u otra revisión.
- El paquete conserva mensaje/triage/pasajes/frases/citas; omite modelo, tiempos, uso y observaciones previas. No aleatoriza orden ni garantiza anonimato o independencia estadística.
- Sesiones del mismo perfil pueden compartir modelo y sesgos. La separación de contextos no convierte sus acuerdos en verdad. Identidad/configuración y exposición se conservan tal como cada ejecución pueda declarar; lo desconocido se registra como desconocido.
- El asistente padre ya vio las respuestas y no se declara revisor ciego.

## Instrucciones de juicio

Aplicar la rúbrica publicada en `docs/draft-semantic-review.md`: respaldo y aplicabilidad de citas por frase, abstención por respuesta, razón en español y pasajes relevantes. Evaluar hechos contra mensaje y pasajes, no tratar resumen como evidencia independiente. Registrar incertidumbre sin forzar consenso. Salidas JSON ligadas al `packetHash`, cobertura completa y sin juicio para intentos excluidos.

## Admisión

Conservar salidas originales antes de validar. El runner comprueba contrato, hashes, cobertura, presencia de citas y existencia de IDs de evidencia, no la verdad de las razones. Si hay un error de contrato, solicitar una corrección explícita de formato conservando ambas salidas, sin imponer etiquetas. No modificar votos para conseguir acuerdo.

Cada dimensión con etiquetas diferentes queda `uncertain`; las razones originales se preservan. No calcular una tasa de exactitud ni ocultar el intento fallido. Resultados diagnósticos de desarrollo, no benchmark ni adjudicación humana.

## Costos y acciones

Estas revisiones usan el modelo del harness y tienen costo de ejecución independiente de las ocho llamadas Groq ya registradas. No hay nuevas llamadas al proveedor de la aplicación, cambio de prompt, corrección automática del producto ni publicación autorizada en esta unidad.
