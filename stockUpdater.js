class StockUpdater {
    constructor() {
        this.updateInterval = 10 * 60 * 1000; // 10 minutos
        this.isRunning = false;
        this.intervalId = null;
    }

    // Iniciar actualizaciones automáticas
    startAutoUpdate() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('🔄 Iniciando actualizaciones automáticas de stock');
        
        // Programar actualizaciones periódicas
        this.intervalId = setInterval(async () => {
            await this.checkAndUpdate();
        }, this.updateInterval);
    }

    // Detener actualizaciones automáticas
    stopAutoUpdate() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('⏹️ Actualizaciones automáticas detenidas');
    }

    // Verificar y actualizar si es necesario
    async checkAndUpdate() {
        try {
            if (!window.stockManager || !window.stockManager.database) return;
            
            const info = window.stockManager.getCalculationInfo();
            const now = Date.now();
            const timeSinceLastCalc = now - info.lastCalculated;
            
            // Si han pasado más de 15 minutos, forzar actualización
            if (timeSinceLastCalc > 15 * 60 * 1000) {
                console.log('⚠️ Datos antiguos detectados, actualizando...');
                await window.stockManager.forceRecalculation();
            }
            
        } catch (error) {
            console.error('Error en actualización automática:', error);
        }
    }

    // Obtener estado del updater
    getStatus() {
        return {
            isRunning: this.isRunning,
            updateInterval: this.updateInterval,
            nextUpdateIn: this.isRunning ? this.updateInterval : null
        };
    }
}

// Crear instancia global
window.stockUpdater = new StockUpdater();
