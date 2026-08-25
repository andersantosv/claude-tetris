---
name: weather
description: Consulta el clima actual usando la API gratuita Open-Meteo (sin API key). Por defecto consulta Lima, Perú, salvo que el usuario pida otra ciudad. Úsala cuando el usuario pida el clima, temperatura, pronóstico actual o condiciones meteorológicas.
---

# Weather

Consulta el clima actual de cualquier ciudad del mundo usando [Open-Meteo](https://open-meteo.com/), una API pública gratuita que no requiere API key.

Por defecto, la ciudad es **Lima, Perú**.

## Cuándo usar esta skill

Cuando el usuario pida el clima, la temperatura, o las condiciones meteorológicas actuales (por ejemplo: "¿qué clima hace?", "dame el clima", "¿qué clima hace en Madrid?").

## Cómo usarla

1. Si el usuario no especificó una ciudad, usá el valor por defecto (Lima, Perú); no hace falta preguntar.
2. Ejecutá el script, pasando la ciudad como argumento solo si el usuario pidió una distinta a Lima:

```bash
python3 .claude/skills/weather/scripts/weather.py            # Lima, Perú (por defecto)
python3 .claude/skills/weather/scripts/weather.py "<ciudad>" # otra ciudad
```

3. Mostrale al usuario el resultado (condición, temperatura, sensación térmica, humedad, precipitación, viento y hora local).

## Notas

- El script primero geocodifica el nombre de la ciudad (Open-Meteo Geocoding API) y luego consulta el clima actual (Open-Meteo Forecast API) para esas coordenadas.
- No requiere API key ni configuración adicional, solo conexión a internet.
- Si la ciudad no se encuentra o falla la conexión, el script termina con un mensaje de error claro por stderr y código de salida distinto de 0.
- Si el nombre de la ciudad es ambiguo (hay varias ciudades con el mismo nombre en distintos países), Open-Meteo devuelve la coincidencia más relevante; si el resultado no es el esperado, pedile al usuario que aclare el país o la provincia (ej. "Córdoba, Argentina" en vez de solo "Córdoba").
