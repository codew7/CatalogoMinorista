class StockManager {
    constructor() {
        this.stockData = [];
        this.isInitialized = false;
        this.listeners = []; // Para notificar cambios a múltiples páginas
        this.database = null;
        this.googleSheetsData = {}; // Para almacenar datos de Google Sheets
    }

    // Inicializar conexión con Firebase y cargar datos de Google Sheets
    async initialize() {
        return new Promise(async (resolve, reject) => {
            if (this.isInitialized) {
                resolve(this.stockData);
                return;
            }

            try {
                // Primero cargar datos de Google Sheets
                await this.loadGoogleSheetsData();
                
                // Luego inicializar Firebase
                this.database = firebase.database();
                
                this.database.ref('movimientos').on('value', (snapshot) => {
                    try {
                        if (!snapshot.exists()) {
                            this.stockData = [];
                            this.isInitialized = true;
                            this.notifyListeners();
                            resolve(this.stockData);
                            return;
                        }

                        const movimientos = snapshot.val();
                        const stockMap = {};
                        
                        // Procesar movimientos para calcular stock actual
                        Object.values(movimientos).forEach(mov => {
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
                            } else if (mov.tipo === 'SALIDA') {
                                stockMap[mov.codigo].stock -= Number(mov.cantidad || 0);
                            } else if (mov.tipo === 'RETIRO') {
                                stockMap[mov.codigo].stock -= Number(mov.cantidad || 0);
                            }
                        });

                        // Ordenar por nombre
                        this.stockData = Object.values(stockMap).sort((a, b) => 
                            a.nombre.localeCompare(b.nombre)
                        );
                        
                        this.isInitialized = true;
                        this.notifyListeners();
                        resolve(this.stockData);
                        
                    } catch (error) {
                        console.error('Error procesando datos:', error);
                        reject(error);
                    }
                }, (error) => {
                    console.error('Error conectando a Firebase:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Error cargando datos de Google Sheets:', error);
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

    // Buscar productos por código o nombre
    searchStock(query) {
        if (!query || query.trim() === '') {
            return this.getAllStock();
        }

        const q = query.toLowerCase().trim();
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
    refresh() {
        this.isInitialized = false;
        this.googleSheetsData = {}; // Limpiar datos de Google Sheets
        return this.initialize();
    }

    // Verificar si un producto existe
    productExists(codigo) {
        return !!this.getStock(codigo);
    }

    // Obtener productos ordenados por diferentes criterios
    getSortedStock(sortBy = 'nombre', order = 'asc') {
        const data = [...this.stockData];
        
        return data.sort((a, b) => {
            let valueA, valueB;
            
            switch(sortBy) {
                case 'codigo':
                    valueA = a.codigo.toString();
                    valueB = b.codigo.toString();
                    break;
                case 'stock':
                    valueA = a.stock;
                    valueB = b.stock;
                    break;
                case 'valor':
                    valueA = a.valor;
                    valueB = b.valor;
                    break;
                default: // 'nombre'
                    valueA = a.nombre;
                    valueB = b.nombre;
            }
            
            if (order === 'desc') {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            } else {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            }
        });
    }

    // Filtrar productos por rango de stock
    getStockByRange(min = 0, max = Infinity) {
        return this.stockData.filter(item => item.stock >= min && item.stock <= max);
    }

    // Obtener valor total del inventario
    getTotalInventoryValue() {
        return this.stockData.reduce((sum, item) => {
            return sum + (item.stock * item.valor);
        }, 0);
    }

    // Busqueda avanzada con múltiples criterios
    advancedSearch(criteria) {
        return this.stockData.filter(item => {
            let matches = true;
            
            if (criteria.codigo) {
                matches = matches && item.codigo.toString().toLowerCase().includes(criteria.codigo.toLowerCase());
            }
            
            if (criteria.nombre) {
                matches = matches && item.nombre.toLowerCase().includes(criteria.nombre.toLowerCase());
            }
            
            if (criteria.minStock !== undefined) {
                matches = matches && item.stock >= criteria.minStock;
            }
            
            if (criteria.maxStock !== undefined) {
                matches = matches && item.stock <= criteria.maxStock;
            }
            
            if (criteria.minValue !== undefined) {
                matches = matches && item.valor >= criteria.minValue;
            }
            
            if (criteria.maxValue !== undefined) {
                matches = matches && item.valor <= criteria.maxValue;
            }
            
            return matches;
        });
    }
}

// Crear instancia global
window.stockManager = new StockManager();

// Exportar también para módulos ES6 si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockManager;
}
