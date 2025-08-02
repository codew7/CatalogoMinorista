class StockManager {
    constructor() {
        this.stockData = [];
        this.isInitialized = false;
        this.listeners = []; // Para notificar cambios a múltiples páginas
        this.database = null;
        this.googleSheetsData = {}; // Para almacenar datos de Google Sheets
        // Nuevas propiedades para sistema precalculado
        this.lastCalculationTime = 0;
        this.calculationInterval = 5 * 60 * 1000; // 5 minutos
        this.usePreCalculated = true;
        this.recalculationTimeout = null;
        this.pendingChanges = 0; // Contador de cambios pendientes
        this.movementListener = null; // Referencia al listener de movimientos
    }

    // Obtener el stock de un lote de productos por sus códigos (batch)
    // Actualiza this.stockData solo con los productos solicitados
    async getStockBatch(codigos = []) {
        if (!Array.isArray(codigos) || codigos.length === 0) return [];
        // Si ya está inicializado y los productos están en stockData, no hace nada
        if (this.isInitialized && codigos.every(cod => this.getStock(cod))) {
            return codigos.map(cod => this.getStock(cod));
        }
        // Si no está inicializado, inicializa primero
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Si ya están todos, retorna
        if (codigos.every(cod => this.getStock(cod))) {
            return codigos.map(cod => this.getStock(cod));
        }
        // Si falta alguno, consulta stockCalculado en Firebase solo para esos códigos
        const snapshot = await this.database.ref('stockCalculado/data').once('value');
        if (!snapshot.exists()) return [];
        const data = snapshot.val();
        // Actualiza this.stockData solo con los productos batch
        let actualizados = [];
        codigos.forEach(cod => {
            if (data[cod]) {
                // Buscar si ya existe en this.stockData
                const idx = this.stockData.findIndex(item => item.codigo == cod);
                if (idx >= 0) {
                    this.stockData[idx] = { ...data[cod] };
                } else {
                    this.stockData.push({ ...data[cod] });
                }
                actualizados.push(data[cod]);
            }
        });
        return actualizados;
    }

    // Eliminar todos los listeners registrados (para optimización en páginas)
    removeAllListeners() {
        this.listeners = [];
    }
    // Inicializar conexión con Firebase y cargar datos
    async initialize() {
        return new Promise(async (resolve, reject) => {
            try {
                // Primero cargar datos de Google Sheets
                await this.loadGoogleSheetsData();
                // Luego inicializar Firebase
                this.database = firebase.database();
                // Intentar cargar datos precalculados primero
                const preCalculatedLoaded = await this.loadPreCalculatedStock();
                if (preCalculatedLoaded) {
                    console.log('🚀 MODO PRECALCULADO: Stock cargado (' + this.stockData.length + ' productos)');
                    // Configurar listener para detectar nuevos movimientos
                    this.setupMovementListener();
                    resolve(this.stockData);
                } else {
                    console.log('⚠️ MODO TIEMPO REAL: Calculando desde movimientos...');
                    // Primera vez o datos corruptos, calcular desde movimientos
                    await this.calculateFromMovements();
                    resolve(this.stockData);
                }
            } catch (error) {
                console.error('Error en inicialización:', error);
                reject(error);
            }
        });
    }

    // Cargar datos de Google Sheets
    async loadGoogleSheetsData() {
        try {
            // Verificar que GOOGLE_SHEETS_CONFIG esté disponible
            if (typeof GOOGLE_SHEETS_CONFIG === 'undefined') {
                console.warn('GOOGLE_SHEETS_CONFIG no está disponible');
                return;
            }

            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.RANGO}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.values) {
                // Procesar datos de Google Sheets
                data.values.forEach(row => {
                    const codigo = row[2]; // Columna C
                    if (codigo) {
                        // Extraer y limpiar precios de columnas E, G e I
                        // Formato esperado: 1,000 = mil (coma como separador de miles)
                        const precioConsumidorRaw = (row[4] || '0').toString().replace(/\$/g, '').trim();
                        const precioMayoristaRaw = (row[6] || '0').toString().replace(/\$/g, '').trim();
                        const costoUnitarioRaw = (row[9] || '0').toString().replace(/\$/g, '').trim();
                        
                        // Convertir números con formato estadounidense (comas como separadores de miles)
                        const precioConsumidor = parseFloat(precioConsumidorRaw.replace(/,/g, '')) || 0;
                        const costoUnitario = parseFloat(costoUnitarioRaw.replace(/,/g, '')) || 0;
                        const precioMayorista = parseFloat(precioMayoristaRaw.replace(/,/g, '')) || 0;
                        
                        this.googleSheetsData[codigo] = {
                            precioConsumidor: precioConsumidor,
                            costoUnitario: costoUnitario,
                            precioMayorista: precioMayorista
                        };
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando datos de Google Sheets:', error);
        }
    }

    // Obtener un producto específico por código
    getStock(codigo) {
        if (!codigo) return null;
        
        return this.stockData.find(item => 
            item.codigo.toString().toLowerCase() === codigo.toString().toLowerCase()
        );
    }

    // Obtener todos los productos
    getAllStock() {
        return [...this.stockData]; // Retornar copia para evitar modificaciones
    }

    // Buscar productos por código o nombre (optimizado)
    searchStock(query) {
        if (!query || query.trim() === '') {
            return this.getAllStock();
        }

        const q = query.toLowerCase().trim();
        
        // Optimización: si la consulta es muy corta, limitar resultados
        if (q.length < 2) {
            return this.stockData.filter(item => {
                const codigo = (item.codigo || '').toString().toLowerCase();
                return codigo.startsWith(q);
            }).slice(0, 100); // Limitar a 100 resultados
        }

        // Búsqueda completa para consultas más largas
        return this.stockData.filter(item => {
            const codigo = (item.codigo || '').toString().toLowerCase();
            const nombre = (item.nombre || '').toString().toLowerCase();
            return codigo.includes(q) || nombre.includes(q);
        });
    }

    // Obtener productos con stock bajo
    getLowStock(threshold = 5) {
        return this.stockData.filter(item => item.stock <= threshold && item.stock > 0);
    }

    // Obtener productos sin stock
    getOutOfStock() {
        return this.stockData.filter(item => item.stock <= 0);
    }

    // Obtener estadísticas del stock
    getStockStats() {
        const total = this.stockData.length;
        const outOfStock = this.getOutOfStock().length;
        const lowStock = this.getLowStock().length;
        const inStock = total - outOfStock;
        
        const totalValue = this.stockData.reduce((sum, item) => {
            return sum + (item.stock * item.valor);
        }, 0);

        return {
            totalProducts: total,
            inStock: inStock,
            outOfStock: outOfStock,
            lowStock: lowStock,
            totalValue: totalValue
        };
    }

    // Sistema de notificaciones para múltiples páginas
    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.stockData);
            } catch (error) {
                console.error('Error en listener:', error);
            }
        });
    }

    // Método para refrescar datos manualmente
    async refresh() {
        this.isInitialized = false;
        this.googleSheetsData = {}; // Limpiar datos de Google Sheets
        
        // Limpiar timeouts pendientes y listeners
        if (this.recalculationTimeout) {
            clearTimeout(this.recalculationTimeout);
        }
        
        // Limpiar listeners para evitar duplicados
        this.cleanupListeners();
        
        return this.initialize();
    }

    // Cargar datos precalculados desde Firebase
    async loadPreCalculatedStock() {
        try {
            const snapshot = await this.database.ref('stockCalculado').once('value');
            if (snapshot.exists()) {
                const calculatedData = snapshot.val();
                
                // Verificar si data es objeto o array para compatibilidad
                let stockData;
                if (Array.isArray(calculatedData.data)) {
                    // Estructura antigua (array con índices numéricos)
                    stockData = calculatedData.data;
                    console.log('📊 Cargando datos con estructura antigua (array)');
                } else {
                    // Nueva estructura (objeto con códigos como claves)
                    stockData = Object.values(calculatedData.data || {});
                    console.log('🎯 Cargando datos con estructura nueva (códigos como claves)');
                }
                
                this.stockData = stockData.sort((a, b) => a.nombre.localeCompare(b.nombre));
                this.lastCalculationTime = calculatedData.lastCalculated || 0;
                this.isInitialized = true;
                this.notifyListeners();
                return true;
            } else {
                console.log('❌ No hay datos precalculados disponibles');
                return false;
            }
        } catch (error) {
            console.error('❌ Error cargando datos precalculados:', error);
            return false;
        }
    }

    // Configurar listener para detectar nuevos movimientos
    setupMovementListener() {
        console.log('👁️ Monitoreando nuevos movimientos...');
        this.pendingChanges = 0;
        
        // Desconectar listener anterior si existe
        if (this.movementListener) {
            this.database.ref('movimientos').off('child_added', this.movementListener);
        }
        
        // Crear nuevo listener con filtro más estricto
        this.movementListener = (snapshot) => {
            const movimiento = snapshot.val();
            // Solo procesar si el timestamp es significativamente mayor (buffer de 1 segundo)
            if (movimiento && movimiento.timestamp > (this.lastCalculationTime + 1000)) {
                console.log(`🆕 Nuevo movimiento detectado: ${movimiento.codigo} - ${movimiento.tipo} (${new Date(movimiento.timestamp).toLocaleString()})`);
                this.pendingChanges++;
                this.scheduleRecalculation();
            } else {
                console.log(`⏭️ Movimiento omitido (ya procesado): ${movimiento.codigo} - ${new Date(movimiento.timestamp).toLocaleString()}`);
            }
        };
        
        // Usar un buffer de tiempo más amplio para evitar procesamiento duplicado
        this.database.ref('movimientos')
            .orderByChild('timestamp')
            .startAt(this.lastCalculationTime + 1000) // Buffer de 1 segundo
            .on('child_added', this.movementListener);
    }

    // Programar recálculo (evita recálculos múltiples)
    scheduleRecalculation() {
        if (this.recalculationTimeout) {
            clearTimeout(this.recalculationTimeout);
        }
        
        this.recalculationTimeout = setTimeout(async () => {
            if (this.pendingChanges > 0) {
                console.log(`🔄 Procesando ${this.pendingChanges} cambios detectados...`);
                this.pendingChanges = 0;
                await this.calculateFromMovements();
            }
        }, 2000); // Esperar 2 segundos para agrupar cambios
    }

    // Calcular stock incrementalmente desde movimientos nuevos y guardar en Firebase
    async calculateFromMovements() {
        try {
            const now = Date.now();
            // 1. Cargar stock actual desde stockCalculado (si existe)
            let stockMap = {};
            let lastCalc = this.lastCalculationTime || 0;
            const stockSnap = await this.database.ref('stockCalculado').once('value');
            if (stockSnap.exists()) {
                const stockData = stockSnap.val();
                if (stockData && stockData.data) {
                    if (Array.isArray(stockData.data)) {
                        stockData.data.forEach(item => {
                            stockMap[item.codigo] = { ...item };
                        });
                    } else {
                        Object.values(stockData.data).forEach(item => {
                            stockMap[item.codigo] = { ...item };
                        });
                    }
                    lastCalc = stockData.lastCalculated || lastCalc;
                }
            }

            // 2. Obtener solo movimientos nuevos (timestamp > lastCalc)
            const movSnap = await this.database.ref('movimientos').orderByChild('timestamp').startAt(lastCalc + 1).once('value');
            const movimientos = movSnap.exists() ? movSnap.val() : {};
            const movimientosArray = Object.values(movimientos).filter(mov => mov.timestamp > lastCalc);

            if (movimientosArray.length === 0) {
                console.log('ℹ️ No hay movimientos nuevos. Stock no actualizado.');
                return;
            }

            // 3. Procesar solo movimientos nuevos
            movimientosArray.forEach(mov => {
                if (!stockMap[mov.codigo]) {
                    const googleData = this.googleSheetsData[mov.codigo] || {};
                    stockMap[mov.codigo] = {
                        codigo: mov.codigo,
                        nombre: mov.nombre,
                        valor: mov.valor || 0,
                        stock: 0,
                        precioConsumidor: googleData.precioConsumidor || 0,
                        costoUnitario: googleData.costoUnitario || 0,
                        precioMayorista: googleData.precioMayorista || 0
                    };
                }
                if (mov.tipo === 'ENTRADA') {
                    stockMap[mov.codigo].stock += Number(mov.cantidad || 0);
                } else if (mov.tipo === 'SALIDA' || mov.tipo === 'RETIRO') {
                    stockMap[mov.codigo].stock -= Number(mov.cantidad || 0);
                }
            });

            // 4. Ordenar por nombre para el array local
            const stockArray = Object.values(stockMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

            // 5. Guardar en Firebase usando códigos como claves
            await this.database.ref('stockCalculado').set({
                data: stockMap,
                lastCalculated: now,
                totalProducts: Object.keys(stockMap).length,
                version: '2.0'
            });

            // 6. Actualizar datos locales
            this.stockData = stockArray;
            this.lastCalculationTime = now;
            this.isInitialized = true;
            this.notifyListeners();

            console.log(`✅ Stock actualizado incrementalmente: ${stockArray.length} productos (${movimientosArray.length} movimientos nuevos procesados)`);
        } catch (error) {
            console.error('❌ Error calculando stock incremental:', error);
        }
    }

    // Forzar recálculo manual
    async forceRecalculation() {
        console.log('🔧 Actualizando stock manualmente...');
        this.lastCalculationTime = 0;
        await this.calculateFromMovements();
    }

    // Método para recálculo completo desde cero
    async fullRecalculation() {
        console.log('🔧 Iniciando recálculo completo desde cero...');
        
        // Desconectar listeners activos
        if (this.movementListener) {
            this.database.ref('movimientos').off('child_added', this.movementListener);
            this.movementListener = null;
        }
        
        // Limpiar datos locales
        this.stockData = [];
        this.lastCalculationTime = 0;
        this.isInitialized = false;
        
        // Eliminar datos precalculados en Firebase
        await this.database.ref('stockCalculado').remove();
        
        // Recalcular desde todos los movimientos
        await this.calculateFromMovements();
        
        // Reconfigurar listener
        this.setupMovementListener();
        
        console.log('✅ Recálculo completo terminado');
        return this.stockData;
    }

    // Limpiar todos los listeners de Firebase
    cleanupListeners() {
        if (this.movementListener) {
            this.database.ref('movimientos').off('child_added', this.movementListener);
            this.movementListener = null;
        }
        if (this.recalculationTimeout) {
            clearTimeout(this.recalculationTimeout);
            this.recalculationTimeout = null;
        }
        console.log('🧹 Listeners limpiados');
    }

    // Obtener información del último cálculo
    getCalculationInfo() {
        return {
            lastCalculated: this.lastCalculationTime,
            lastCalculatedDate: new Date(this.lastCalculationTime).toLocaleString(),
            totalProducts: this.stockData.length,
            isUsingPreCalculated: this.usePreCalculated,
            pendingChanges: this.pendingChanges,
            hasMovementListener: !!this.movementListener
        };
    }

    // Método de debugging para verificar la sincronización
    async debugMovements(codigo = null) {
        try {
            console.log('🔍 INICIANDO DEBUG DE MOVIMIENTOS');
            console.log('📅 Último cálculo:', new Date(this.lastCalculationTime).toLocaleString());
            
            // Obtener stock calculado
            const stockSnap = await this.database.ref('stockCalculado').once('value');
            const stockCalculado = stockSnap.exists() ? stockSnap.val() : null;
            
            // Obtener todos los movimientos
            const movSnap = await this.database.ref('movimientos').once('value');
            const movimientos = movSnap.exists() ? Object.values(movSnap.val()) : [];
            
            if (codigo) {
                // Debug específico para un código
                const movimientosCodigo = movimientos.filter(mov => mov.codigo === codigo);
                const stockProducto = stockCalculado?.data?.[codigo];
                
                console.log(`📦 PRODUCTO ${codigo}:`);
                console.log('Stock calculado:', stockProducto?.stock || 'No encontrado');
                console.log('Movimientos encontrados:', movimientosCodigo.length);
                
                let stockManual = 0;
                movimientosCodigo
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .forEach(mov => {
                        if (mov.tipo === 'ENTRADA') {
                            stockManual += Number(mov.cantidad || 0);
                        } else if (mov.tipo === 'SALIDA' || mov.tipo === 'RETIRO') {
                            stockManual -= Number(mov.cantidad || 0);
                        }
                        console.log(`📊 ${new Date(mov.timestamp).toLocaleString()} - ${mov.tipo} - ${mov.cantidad} - Stock acumulado: ${stockManual}`);
                    });
                
                console.log(`✅ Stock manual calculado: ${stockManual}`);
                console.log(`🎯 Stock en sistema: ${stockProducto?.stock || 0}`);
                console.log(`${stockManual === (stockProducto?.stock || 0) ? '✅ COINCIDEN' : '❌ NO COINCIDEN'}`);
            } else {
                // Debug general
                console.log('📊 Total movimientos:', movimientos.length);
                console.log('📦 Total productos en stock:', stockCalculado?.totalProducts || 0);
                console.log('⏰ Última actualización:', new Date(stockCalculado?.lastCalculated || 0).toLocaleString());
                
                // Verificar movimientos posteriores al último cálculo
                const movimientosPosteriores = movimientos.filter(mov => 
                    mov.timestamp > (this.lastCalculationTime + 1000)
                );
                console.log('🔄 Movimientos pendientes:', movimientosPosteriores.length);
                
                if (movimientosPosteriores.length > 0) {
                    console.log('📋 Movimientos pendientes:');
                    movimientosPosteriores.forEach(mov => {
                        console.log(`- ${mov.codigo} - ${mov.tipo} - ${mov.cantidad} (${new Date(mov.timestamp).toLocaleString()})`);
                    });
                }
            }
            
            console.log('🔍 DEBUG COMPLETADO');
        } catch (error) {
            console.error('❌ Error en debug:', error);
        }
    }
}

// Crear instancia global
window.stockManager = new StockManager();

// Exportar también para módulos ES6 si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockManager;
}
