# OBSERVATORIO-FEPCAF-
Repositorio creado para el procesamiento de datos relacionados con el Observatorio de datos FEPCafé.

## Observatorio Cafetero · Dashboard

Aplicación web (React + TypeScript + Tailwind + Recharts) que implementa el
dashboard "Observatorio Cafetero · Informe Mensual" con seis secciones:

- **Precio Interno**: KPIs de precio interno, Contrato C, diferencial UGQ y
  TRM, sus series de tiempo, la descomposición mensual del precio de
  referencia y un análisis de sensibilidad (KC × TRM).
- **Producción**: producción acumulada 12 meses, producción mensual histórica,
  producción por año cafetero, y la condición agroclimática/fitosanitaria
  (índice RONI y su pronóstico con bandas de confianza P25-P75).
- **Costo Medio de Producción**: indicador principal, serie histórica,
  estructura del costo (torta y detalle) y evolución de precios de insumos.
- **Índices de Precios**: variación anual del IPC y el IPP por categoría.
- **Mecanismo PAI**: tabla de precios de fertilizantes de referencia, su
  evolución en los últimos 48 meses, e indicadores del Programa de Apoyo a
  la Inversión.
- **Mecanismo MeCIC**: tabla de referencia y sistema de alertas (costo medio,
  límite superior, media móvil y precio interno).

Todos los datos son de ejemplo (`src/data/*.ts`), generados de forma
determinística para tener series realistas; están aislados por página para
poder reemplazarse por fuentes reales (FNC, DANE, Banco de la República,
etc.) sin tocar los componentes de UI.

### Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción
```

