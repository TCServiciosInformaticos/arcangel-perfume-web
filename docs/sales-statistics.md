# Estadísticas del admin

Acceso: `/admin/estadisticas`, desde el menú o el Resumen. La consulta requiere sesión y rol admin tanto en la página como en PostgreSQL. La función es `SECURITY INVOKER`, conserva RLS y no retorna datos de clientes ni credenciales.

- Períodos inclusivos de 1 a 366 días, horario America/Argentina/Buenos_Aires. Comparación con el mismo número de días inmediatamente anterior.
- Venta elegible: pedido paid/preparing/shipped/delivered con mp_payment_id y un intento approved del mismo pedido y payment_id. Se cuenta cada pedido una vez, incluso archivado. Sin evidencia se excluye y se muestra una advertencia.
- Fecha: primer evento payment_approved que coincide con el pago aceptado del pedido. Si falta el evento histórico, fecha del intento y aviso de fecha estimada. No se usa updated_at.
- Sin filtros de clasificación: total y ticket incluyen envío. Con categoría/marca: suman únicamente líneas seleccionadas, sin envío; el pedido se cuenta una vez. Unidades/rankings/desgloses usan cantidades y precios efectivamente pagados del pedido, no precios actuales.
- Estados de pedidos: cohorte por fecha de creación, estado actual. No confundir con ventas por fecha de cobro.
- Artículos sin ventas: visibles creados hasta el cierre del período, sin unidades vendidas. Menos vendidos separa los ceros. No existe historial de disponibilidad: el saldo mostrado es actual y no prueba que un producto haya estado disponible durante el período.
- Alertas: visibles con saldo actual menor o igual al umbral elegido (incluye agotados), independientes de las fechas; conservan filtros de categoría/marca. Umbral inicial 5, ajustable para la consulta.
- Excel: resumen, evolución, todos los artículos del informe (sin límite de la página visible), categorías, marcas y estados. Lectura únicamente; no cambia precios ni stock.
- No mide margen ni devoluciones: el sistema aún no registra costos/devoluciones como movimientos contables. Pedidos cancelados no se incluyen. Tampoco representa ventas fuera de la web.

## Validación

Pruebas unitarias: calendario argentino, comparación, períodos inválidos, ranking, stock y productos nuevos/ocultos.
Pruebas SQL: `supabase/tests/admin_sales_statistics.sql`, sobre una base de prueba con la migración y un admin existente. Fixtures con números/IDs explícitos y ROLLBACK; verifica cobros, duplicación, archivo, medianoche argentina, filtro, envíos, registros completos y denegación a no-admin. El usuario anónimo carece de EXECUTE.
Pruebas de navegador: `e2e/statistics.spec.ts`, solo origen local y datos/sesión ficticios; prueba ranking, paginación, fecha inválida y Excel completo en escritorio/celular.
