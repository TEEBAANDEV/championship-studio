# Championship Studio

Aplicación de escritorio para gestionar campeonatos de automovilismo: tabla de pilotos y constructores,
bolsa de puntos, probabilidades matemáticas, simulador Monte Carlo y un archivo histórico de temporadas (1950–2026).

## Qué incluye

- **Campeonato y puntos**: clasificación en vivo, techo matemático y chances de cada piloto y escudería.
- **Simulador de probabilidades**: miles de temporadas simuladas para estimar posiciones finales.
- **Qué necesita para cada puesto**: escenarios exactos, incluida la última carrera con desempate oficial.
- **Pistas y resultados**: calendario, resultados con arrastrar y soltar, DNF / DNS / DSQ y carreras con mitad o doble de puntos.
- **Historia (1950–2026)**: 77 temporadas, pilotos, escuderías y circuitos para probar cualquier año.
- **Resultados automáticos**: la temporada en curso se actualiza sola después de cada carrera.

## Actualización automática de resultados

1. Una automatización de GitHub (`.github/workflows/update-data.yml`) corre de viernes a lunes cada 3 horas.
2. Ejecuta `scripts/update_live_data.js`, que consulta la API pública de resultados y escribe `data/live/season_current.json` y `data/live/manifest.json`. Solo guarda cambios si hubo una carrera nueva.
3. La app revisa al abrir si hay resultados más recientes y muestra un aviso para actualizar. También hay un botón **Buscar resultados nuevos**.

Para que cualquier persona reciba los datos desde tu repositorio, publica la carpeta `data/live` en una dirección pública
(por ejemplo con GitHub Pages) y pon esa dirección en `src/live_config.js` (`baseUrl`).
Si `baseUrl` queda vacío, la app consulta directamente la API pública.

Para actualizar a mano: `node scripts/update_live_data.js`

## Créditos y aviso legal

- Datos históricos: [F1DB](https://github.com/f1db/f1db) (licencia CC BY 4.0).
- Resultados de la temporada en curso: [Jolpica-F1](https://github.com/jolpica/jolpica-f1) (API compatible con Ergast).
- Proyecto hecho por fans, **sin relación** con Formula 1, la FIA ni ningún equipo o patrocinador.
  Los nombres de pilotos y escuderías se usan solo para identificar datos públicos de resultados.
- La aplicación no incluye fotos ni logos oficiales. Los cascos y escudos se generan automáticamente,
  y cada persona puede agregar sus propias imágenes en la carpeta `imagenes/`.

## Datos personales

Tu campeonato se guarda en tu equipo. Las simulaciones y resultados que anotes no se borran cuando se actualizan los datos oficiales,
salvo que elijas reemplazar el campeonato abierto.
