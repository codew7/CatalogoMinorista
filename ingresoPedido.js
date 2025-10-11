// Script para ingresoPedido.html: manejo de formulario, artículos dinámicos y registro en Firebase

document.addEventListener('DOMContentLoaded', function() {
  // --- TAB = Agregar Artículo ---
  // === BLOQUEO DE CONTROLES HASTA CARGA DE ARTÍCULOS ===
  // Elementos a bloquear: inputs, selects, botones, tabla de artículos
  // Usar las referencias ya declaradas más abajo
  let bloqueables = [];
  // La declaración de form, addItemBtn, itemsBody ya existe más abajo
  // Por lo tanto, solo inicializar bloqueables después de esas declaraciones
  // (El resto del código sigue igual hasta la declaración de form, itemsBody, addItemBtn)
  // === OPTIMIZACIÓN: TAB HANDLER CON THROTTLING ===
  let tabHandlerTimeout;
  document.addEventListener('keydown', function(e) {
    // Solo si es TAB, sin Shift, y no en textarea ni en select2 search
    if (e.key === 'Tab' && !e.shiftKey) {
      const active = document.activeElement;
      // No interceptar si está en textarea, input tipo hidden, o en el buscador de select2
      if (active && (
        active.tagName === 'TEXTAREA' ||
        (active.tagName === 'INPUT' && active.type === 'hidden') ||
        (active.classList && active.classList.contains('select2-search__field'))
      )) {
        return;
      }
      
      e.preventDefault();
      
      // Usar throttling para evitar múltiples ejecuciones rápidas
      clearTimeout(tabHandlerTimeout);
      tabHandlerTimeout = setTimeout(() => {
        const btn = document.getElementById('addItemBtn');
        if (btn && !btn.disabled) {
          btn.click();
        }
      }, 50);
    }
  }, { passive: false }); // Especificar passive: false para preventDefault
  // Firebase ya está inicializado en el HTML

  // Elementos del DOM
  const form = document.getElementById('orderForm');
  const itemsBody = document.getElementById('itemsBody');
  const addItemBtn = document.getElementById('addItemBtn');
  const barcodeInput = document.getElementById('barcodeInput');
  const barcodeStatus = document.getElementById('barcodeStatus');
  const barcodeQuantity = document.getElementById('barcodeQuantity');
  // Inicializar bloqueables aquí, después de declarar form, itemsBody, addItemBtn
  bloqueables = [];
  if (form) {
    Array.from(form.elements).forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'BUTTON' || el.type === 'button' || el.type === 'submit') {
        bloqueables.push(el);
      }
    });
  }
  if (addItemBtn) bloqueables.push(addItemBtn);
  if (itemsBody) bloqueables.push(itemsBody);
  function setControlesBloqueados(bloquear) {
    bloqueables.forEach(el => {
      if (!el) return;
      if (el === itemsBody) {
        Array.from(itemsBody.querySelectorAll('input, select, button')).forEach(ctrl => {
          ctrl.disabled = bloquear;
          if (bloquear) ctrl.classList.add('cargando-articulos');
          else ctrl.classList.remove('cargando-articulos');
        });
      } else {
        el.disabled = bloquear;
        if (bloquear) el.classList.add('cargando-articulos');
        else el.classList.remove('cargando-articulos');
      }
    });
    if (bloquear) {
      document.body.classList.add('cargando-articulos-body');
    } else {
      document.body.classList.remove('cargando-articulos-body');
    }
  }
  // Bloquear al inicio
  setControlesBloqueados(true);
  const subtotalInput = document.getElementById('subtotal');
  const totalFinalInput = document.getElementById('totalFinal');
  const recargoInput = document.getElementById('recargo');
  const descuentoInput = document.getElementById('descuento');
  const descuentoPorcentajeInput = document.getElementById('descuentoPorcentaje');
  const envioInput = document.getElementById('envio');
  const messageDiv = document.getElementById('message');

  let items = [];

  // === DETECCIÓN GLOBAL DE ESCÁNER DE CÓDIGO DE BARRAS ===
  let barcodeBuffer = '';
  let barcodeTimeout = null;
  let isProcessingBarcode = false;
  const BARCODE_INPUT_SPEED = 50; // Los scanners escriben en menos de 50ms
  const MIN_BARCODE_LENGTH = 3;
  
  // Listener global para detectar input rápido del escáner
  document.addEventListener('keypress', function(e) {
    // Ignorar si ya estamos procesando un código
    if (isProcessingBarcode) {
      return;
    }
    
    // Ignorar si ya estamos en el campo de código de barras
    if (document.activeElement === barcodeInput) {
      return;
    }
    
    // Ignorar si estamos en un textarea o en campos específicos que necesitan input normal
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.classList.contains('select2-search__field') ||
      activeElement.id === 'nombre' ||
      activeElement.id === 'telefono' ||
      activeElement.id === 'direccion' ||
      activeElement.id === 'dni' ||
      activeElement.id === 'email' ||
      activeElement.id === 'observaciones'
    )) {
      return;
    }
    
    // Ignorar teclas especiales y Enter
    if (e.key === 'Enter' || e.key === 'Tab' || e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }
    
    // Acumular caracteres
    barcodeBuffer += e.key;
    
    // Limpiar timeout anterior
    clearTimeout(barcodeTimeout);
    
    // Establecer nuevo timeout
    barcodeTimeout = setTimeout(() => {
      // Si el buffer tiene contenido después del timeout, no es un scanner
      // (el usuario escribe más lento)
      barcodeBuffer = '';
    }, BARCODE_INPUT_SPEED);
    
    // Si acumulamos suficientes caracteres rápidamente, es probable que sea un scanner
    if (barcodeBuffer.length >= MIN_BARCODE_LENGTH) {
      // Prevenir que el input vaya al campo actual
      e.preventDefault();
      
      // Redirigir al campo de código de barras
      if (barcodeInput && !isProcessingBarcode) {
        // Si no estamos en el campo correcto, mover el foco
        if (document.activeElement !== barcodeInput) {
          // Limpiar el buffer del campo actual si es un input
          if (activeElement && activeElement.tagName === 'INPUT') {
            // Restaurar el valor original (sin los caracteres del scanner)
            const currentValue = activeElement.value || '';
            const charsToRemove = barcodeBuffer.length - 1; // -1 porque el último carácter está en e.key
            if (currentValue.length >= charsToRemove) {
              activeElement.value = currentValue.substring(0, currentValue.length - charsToRemove);
            }
          }
          
          // Mostrar indicador visual
          if (barcodeStatus) {
            showBarcodeStatus('scanning');
          }
        }
      }
      
      // Continuar esperando más caracteres del scanner
      clearTimeout(barcodeTimeout);
      barcodeTimeout = setTimeout(() => {
        // Cuando termina el escaneo, procesar el código
        if (barcodeInput && barcodeBuffer.length >= MIN_BARCODE_LENGTH && !isProcessingBarcode) {
          isProcessingBarcode = true;
          
          // Enfocar el campo de código de barras
          barcodeInput.focus();
          
          // Limpiar y establecer el valor
          barcodeInput.value = barcodeBuffer.trim();
          
          // Procesar el código directamente (sin disparar Enter)
          processBarcodeInput(barcodeBuffer.trim());
          
          // Resetear después de un pequeño delay
          setTimeout(() => {
            isProcessingBarcode = false;
          }, 200);
        }
        barcodeBuffer = '';
      }, 100); // Esperar 100ms después del último carácter
    }
  });
  
  // Limpiar buffer si cambiamos de campo manualmente
  document.addEventListener('focusin', function(e) {
    if (e.target !== barcodeInput && barcodeBuffer.length > 0) {
      barcodeBuffer = '';
      clearTimeout(barcodeTimeout);
    }
  });
  
  // Auto-enfocar el campo de código de barras al cargar la página
  window.addEventListener('load', function() {
    setTimeout(() => {
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 500);
  });

  // === COTIZACIÓN DÓLAR ===
  const cotizacionValorElement = document.getElementById('cotizacionValor');
  let cotizacionActual = null;

  function cargarCotizacionDolar() {
    if (!cotizacionValorElement) return;
    
    cotizacionValorElement.textContent = 'Cargando...';
    
    fetch('https://api.bluelytics.com.ar/v2/latest')
      .then(response => response.json())
      .then(data => {
        cotizacionActual = data.blue.value_sell || data.blue.sell;
        if (cotizacionActual) {
          cotizacionValorElement.textContent = `$${cotizacionActual.toLocaleString('es-AR')}`;
          cotizacionValorElement.style.color = '#28a745';
        } else {
          cotizacionValorElement.textContent = 'No disponible';
          cotizacionValorElement.style.color = '#dc3545';
        }
      })
      .catch(error => {
        console.error('Error al cargar cotización:', error);
        cotizacionValorElement.textContent = 'Error al cargar';
        cotizacionValorElement.style.color = '#dc3545';
      });
  }

  // Cargar cotización al inicializar
  cargarCotizacionDolar();

  // === CARGA DE ARTÍCULOS DESDE GOOGLE SHEETS ===
  let articulosDisponibles = [];
  let articulosPorCodigo = {};
  let articulosPorNombre = {};

  // Radios de tipo de cliente
  let radiosTipoCliente = [];
  // Insertar radios de tipo de cliente debajo de Datos del Cliente
  const clienteSection = document.querySelector('section[aria-labelledby="datos-cliente-title"]');
  if (clienteSection && !document.getElementById('tipoClienteRow')) {
    const tipoClienteRow = document.createElement('div');
    tipoClienteRow.className = 'form-row';
    tipoClienteRow.id = 'tipoClienteRow';
    tipoClienteRow.innerHTML = `
      <label style="font-weight:bold;">Tipo de Cliente:</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="consumidor final"> Consumidor</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="mayorista" checked> Mayorista</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="admin"> Administrador</label>
    `;
    clienteSection.appendChild(tipoClienteRow);
    // Guardar referencia a los radios
    radiosTipoCliente = Array.from(tipoClienteRow.querySelectorAll('input[type="radio"][name="tipoCliente"]'));
  } else if (clienteSection) {
    radiosTipoCliente = Array.from(document.querySelectorAll('input[type="radio"][name="tipoCliente"]'));
  }

  // === FUNCIÓN PARA ACTUALIZAR TODOS LOS ITEMS DESPUÉS DE CARGAR GOOGLE SHEETS ===
  function actualizarTodosLosItems() {
    items.forEach(item => {
      if (item.nombre && articulosPorNombre[item.nombre]) {
        // Preservar cantidad actual
        const cantidadActual = item.cantidad;
        // Usar función auxiliar para actualizar campos
        actualizarCamposArticulo(item, item.nombre);
        // Restaurar cantidad
        item.cantidad = cantidadActual;
        // Recalcular valorG
        item.valorG = (item.valorU - item.valorC) * (item.cantidad || 1);
      }
    });
    // Re-renderizar para mostrar cambios
    renderItems();
  }

  // Cargar artículos al iniciar
  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.RANGO}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`)
    .then(response => response.json())
    .then(data => {
      const items = data.values || [];
      articulosDisponibles = items.filter(item => item[4]?.toLowerCase() !== 'no disponible');
      articulosDisponibles.forEach(item => {
        // Usar Columna L (índice 11) para códigos de barras (puede contener múltiples códigos separados por comas)
        if (item[11]) {
          const codigosBarras = item[11].split(',');
          codigosBarras.forEach(codigo => {
            const codigoLimpio = codigo.trim();
            if (codigoLimpio) { // Solo agregar códigos no vacíos
              articulosPorCodigo[codigoLimpio] = item;
            }
          });
        }
        articulosPorNombre[item[3]] = item;
      });
      
      // Invalidar cache al cargar nuevos artículos
      articulosOrdenadosCache = null;
      optionsHtmlCache = '';
      
      // Actualizar items existentes con datos frescos de Google Sheets
      actualizarTodosLosItems();
      // Habilitar controles después de cargar
      setControlesBloqueados(false);
      // Mantener tipoCliente como solo lectura
      radiosTipoCliente.forEach(radio => radio.disabled = true);
      
      // Inicializar scanner de código de barras después de cargar artículos
      initializeBarcodeScanner();
    })
    .catch(() => {
      // Si falla la carga, mantener controles deshabilitados
      setControlesBloqueados(true);
      radiosTipoCliente.forEach(radio => radio.disabled = true);
    });
  // === ESTILOS PARA BLOQUEO VISUAL ===
  const styleCargando = document.createElement('style');
  styleCargando.innerHTML = `
    .cargando-articulos { opacity: 0.6 !important; cursor: not-allowed !important; }
    .cargando-articulos-body { cursor: progress !important; }
    .optimizing-table { opacity: 0.8; pointer-events: none; }
    .optimizing-table::after { 
      content: 'Optimizando tabla...'; 
      position: absolute; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      background: rgba(255,255,255,0.9); 
      padding: 10px 20px; 
      border-radius: 4px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-weight: bold;
      z-index: 1000;
    }
  `;
  document.head.appendChild(styleCargando);

  // Helper: always read current cliente type from DOM
function getTipoCliente() {
  const sel = document.querySelector('input[name="tipoCliente"]:checked');
  return sel ? sel.value : 'consumidor final';
}

  // === FUNCIÓN PARA OBTENER LA PRIMERA IMAGEN DE UN ARTÍCULO ===
  function obtenerPrimeraImagen(nombreArticulo) {
    if (!nombreArticulo || !articulosPorNombre[nombreArticulo]) {
      return '';
    }
    const art = articulosPorNombre[nombreArticulo];
    const imagenesStr = art[1] || ''; // Columna B (índice 1)
    if (!imagenesStr) return '';
    
    // Dividir por comas y tomar la primera imagen
    const imagenes = imagenesStr.split(',');
    return imagenes[0]?.trim() || '';
  }

  // === FUNCIÓN PARA CREAR EFECTO HOVER DE IMAGEN (OPTIMIZADA) ===
  let allHoverDivs = new Map(); // Para gestionar todos los hover divs
  
  function crearHoverImagen(imgElement, imagenUrl) {
    if (!imagenUrl) return;
    
    let hoverDiv = null;
    const hoverKey = Math.random().toString(36).substring(7); // ID único
    
    function showHover() {
      // Crear div flotante si no existe
      if (!hoverDiv) {
        hoverDiv = document.createElement('div');
        hoverDiv.style.position = 'fixed';
        hoverDiv.style.zIndex = '10000';
        hoverDiv.style.backgroundColor = 'white';
        hoverDiv.style.border = '2px solid #ccc';
        hoverDiv.style.borderRadius = '8px';
        hoverDiv.style.padding = '5px';
        hoverDiv.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
        hoverDiv.style.pointerEvents = 'none';
        hoverDiv.style.display = 'none';
        
        const hoverImg = document.createElement('img');
        hoverImg.src = imagenUrl;
        hoverImg.style.width = '300px';
        hoverImg.style.height = '300px';
        hoverImg.style.objectFit = 'cover';
        hoverImg.style.display = 'block';
        hoverImg.style.borderRadius = '4px';
        
        // Manejar error de carga de imagen grande
        hoverImg.onerror = function() {
          hoverDiv.innerHTML = '<div style="width:150px;height:150px;display:flex;align-items:center;justify-content:center;color:#666;font-size:14px;">Imagen no disponible</div>';
        };
        
        hoverDiv.appendChild(hoverImg);
        document.body.appendChild(hoverDiv);
        
        // Registrar en el mapa para limpieza posterior
        allHoverDivs.set(hoverKey, hoverDiv);
      }
      
      // Posicionar cerca del mouse, ajustando para no salirse de la pantalla
      const rect = imgElement.getBoundingClientRect();
      let left = rect.right + 10;
      let top = rect.top - 75;
      
      // Ajustar si se sale de la pantalla por la derecha
      if (left + 160 > window.innerWidth) {
        left = rect.left - 160;
      }
      
      // Ajustar si se sale de la pantalla por arriba
      if (top < 0) {
        top = 10;
      }
      
      // Ajustar si se sale de la pantalla por abajo
      if (top + 160 > window.innerHeight) {
        top = window.innerHeight - 170;
      }
      
      hoverDiv.style.left = left + 'px';
      hoverDiv.style.top = top + 'px';
      hoverDiv.style.display = 'block';
    }
    
    function hideHover() {
      if (hoverDiv) {
        hoverDiv.style.display = 'none';
      }
    }
    
    // Event listeners con throttling
    let mouseEnterTimeout;
    imgElement.addEventListener('mouseenter', function(e) {
      clearTimeout(mouseEnterTimeout);
      mouseEnterTimeout = setTimeout(showHover, 100); // Pequeño delay para evitar hover accidental
    });
    
    imgElement.addEventListener('mouseleave', function() {
      clearTimeout(mouseEnterTimeout);
      hideHover();
    });
    
    // Retornar función de limpieza para llamar manualmente
    return function cleanup() {
      clearTimeout(mouseEnterTimeout);
      if (hoverDiv && hoverDiv.parentNode) {
        hoverDiv.parentNode.removeChild(hoverDiv);
        allHoverDivs.delete(hoverKey);
      }
    };
  }
  
  // Función global para limpiar todos los hover divs huérfanos
  function cleanupAllHovers() {
    allHoverDivs.forEach((hoverDiv, key) => {
      if (hoverDiv && hoverDiv.parentNode) {
        hoverDiv.parentNode.removeChild(hoverDiv);
      }
    });
    allHoverDivs.clear();
  }

  // === FUNCIÓN AUXILIAR PARA ACTUALIZAR CAMPOS DE ARTÍCULO ===
  function actualizarCamposArticulo(item, nombre) {
    if (!nombre || !articulosPorNombre[nombre]) {
      // Si no hay artículo, limpiar campos
      item.codigo = '';
      item.codigoBarras = '';
      item.nombre = '';
      item.valorU = 0;
      item.valorC = 0;
      item.categoria = '';
      item.seleccionado = '';
      item.valorG = 0;
      return;
    }

    const art = articulosPorNombre[nombre];
    const currentTipo = getTipoCliente();
    
    // Asignar campos básicos
    item.codigo = art[2] || ''; // Código interno (Columna C)
    item.codigoBarras = art[11] || ''; // Código de barras (Columna L)
    item.nombre = art[3] || '';
    
    // Asignar valorU según tipo de cliente
      let valorRaw;
      if (currentTipo === 'admin') {
        valorRaw = art[7] || '0';
      } else if (currentTipo === 'consumidor final') {
        valorRaw = art[4] || '0';
      } else {
        valorRaw = art[6] || '0';
      }
      valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
      item.valorU = parseInt(valorRaw) || 0;
    
    // Asignar valorC desde columna H (índice 7)
    let valorCRaw = art[7] || '0';
    valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
    item.valorC = parseInt(valorCRaw) || 0;
    
    // Asignar categoria desde columna A (índice 0) - SIEMPRE
    item.categoria = art[0] || '';
    
    // Asignar seleccionado desde columna J (índice 9) - SIEMPRE
    item.seleccionado = art[9] || '';
    
    // Calcular valorG
    item.valorG = (item.valorU - item.valorC) * (item.cantidad || 1);
    
  }

  // === CACHE PARA OPTIMIZACIÓN ===
  let articulosOrdenadosCache = null;
  let optionsHtmlCache = '';

  function getArticulosOrdenados() {
    if (!articulosOrdenadosCache) {
      articulosOrdenadosCache = [...articulosDisponibles].sort((a, b) => {
        const nombreA = (a[3] || '').toLowerCase();
        const nombreB = (b[3] || '').toLowerCase();
        return nombreA.localeCompare(nombreB, 'es');
      });
      // Generar HTML de opciones una sola vez
      optionsHtmlCache = '<option value="">Seleccione artículo</option>' + 
        articulosOrdenadosCache.map(art => 
          `<option value="${art[3]}" data-codigo="${art[2]}" data-precio="${art[6] || art[5] || ''}">${art[3]}</option>`
        ).join('');
    }
    return articulosOrdenadosCache;
  }

  // === OPTIMIZACIÓN: CREAR UNA SOLA FILA ===
  function createRowElement(item, idx) {
    const articulosOrdenados = getArticulosOrdenados();
    const primeraImagen = obtenerPrimeraImagen(item.nombre);
    
    const row = document.createElement('tr');
    row.setAttribute('data-idx', idx);
    
    row.innerHTML = `
      <td style="text-align:center;">
        ${primeraImagen ? `<img src="${primeraImagen}" class="articulo-img" style="width:50px;height:50px;object-fit:cover;border-radius:4px;cursor:pointer;" alt="Imagen del artículo" onerror="this.style.display='none'">` : '<span style="color:#ccc;">Sin img</span>'}
      </td>
      <td><input type="text" value="${item.codigo || ''}" class="codigo" maxlength="20" style="width:80px" readonly></td>
      <td>
        <select class="nombre-select" data-idx="${idx}" style="width:220px">
          ${optionsHtmlCache}
        </select>
      </td>
      <td><input type="number" value="${item.cantidad}" class="cantidad" min="1" style="width:60px"></td>
      <td><input type="text" value="${item.valorU}" class="valorU" min="0" step="1" style="width:80px"></td>
      <td class="valorTotal">${(item.cantidad * item.valorU).toLocaleString('es-AR', {maximumFractionDigits:0})}</td>
      <td><button type="button" class="remove-btn" data-idx="${idx}" style="background:#d32f2f;color:#fff;border:none;border-radius:4px;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Eliminar"><span style="font-weight:bold;font-size:20px;line-height:1;">&times;</span></button></td>
    `;

    // Seleccionar la opción correcta
    if (item.nombre) {
      const select = row.querySelector('.nombre-select');
      select.value = item.nombre;
    }

    return row;
  }

  // === OPTIMIZACIÓN: SETUP DE EVENT LISTENERS PARA UNA FILA ===
  function setupRowEventListeners(row, idx) {
    const select = row.querySelector('.nombre-select');
    const removeBtn = row.querySelector('.remove-btn');
    const imgElement = row.querySelector('.articulo-img');
    
    // Event listener para select (throttled)
    let selectChangeTimeout;
    select.addEventListener('change', function() {
      clearTimeout(selectChangeTimeout);
      selectChangeTimeout = setTimeout(() => {
        handleSelectChange(this, idx);
      }, 50);
    });
    
    // Event listener para botón eliminar
    removeBtn.addEventListener('click', function() {
      removeItem(idx);
    });
    
    // Configurar efecto hover para imagen con cleanup
    let hoverCleanup = null;
    if (imgElement) {
      const primeraImagen = obtenerPrimeraImagen(items[idx].nombre);
      if (primeraImagen) {
        hoverCleanup = crearHoverImagen(imgElement, primeraImagen);
      }
    }

    // Inicializar Select2 de forma asíncrona
    const $select = $(select);
    
    // Configurar Select2 con configuración optimizada
    requestAnimationFrame(() => {
      try {
        $select.select2({
          placeholder: 'Seleccione artículo',
          width: '95%',
          minimumResultsForSearch: 10, // Solo mostrar búsqueda si hay más de 10 items
          dropdownAutoWidth: true,
          templateResult: function(option) {
            // Template simple para mejor rendimiento
            if (!option.id) return option.text;
            return $('<span>').text(option.text);
          }
        });
        
        $select.on('select2:select', function(e) {
          // Usar setTimeout para no bloquear el hilo principal
          setTimeout(() => {
            this.dispatchEvent(new Event('change', { bubbles: true }));
          }, 0);
        });
        
        // Manejar cierre del selector sin selección
        $select.on('select2:close', function(e) {
          setTimeout(() => {
            // Verificar si la fila está vacía (sin artículo seleccionado)
            const currentItem = items[idx];
            if (currentItem && !currentItem.nombre) {
              // Si es la última fila y está vacía, eliminarla
              const isLastRow = idx === items.length - 1;
              if (isLastRow) {
                removeItem(idx);
              }
            }
          }, 100);
        });
      } catch (error) {
        console.warn('Error inicializando Select2:', error);
      }
    });

    // Retornar objetos y función de cleanup
    return { 
      select: $select,
      cleanup: function() {
        clearTimeout(selectChangeTimeout);
        if (hoverCleanup) hoverCleanup();
        try {
          if ($select.hasClass('select2-hidden-accessible')) {
            $select.select2('destroy');
          }
        } catch (e) {
          // Silenciar errores de destrucción de Select2
        }
      }
    };
  }

  // === OPTIMIZACIÓN: MANEJAR CAMBIO DE SELECT ===
  function handleSelectChange(selectElement, idx) {
    const nombreSel = selectElement.value;
    const row = selectElement.closest('tr');
    
    // Verificar si el producto ya existe en otra fila
    if (nombreSel) {
      const existingIndex = items.findIndex((item, index) => 
        index !== idx && item.nombre === nombreSel
      );
      
      if (existingIndex !== -1) {
        // Sumar cantidad al producto existente
        items[existingIndex].cantidad += items[idx].cantidad;
        
        // Actualizar la fila existente
        const existingRow = itemsBody.querySelector(`tr[data-idx="${existingIndex}"]`);
        if (existingRow) {
          const cantidadInput = existingRow.querySelector('.cantidad');
          const valorTotalCell = existingRow.querySelector('.valorTotal');
          
          cantidadInput.value = items[existingIndex].cantidad;
          valorTotalCell.textContent = (items[existingIndex].cantidad * items[existingIndex].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
          
          // Highlight temporal de la fila existente
          existingRow.style.backgroundColor = '#fff3cd';
          setTimeout(() => {
            existingRow.style.backgroundColor = '';
          }, 1500);
        }
        
        // Remover la fila actual
        removeItem(idx);
        
        // Mostrar notificación toast con imagen
        showBarcodeNotification(nombreSel, items[existingIndex].cantidad, true);
        
        return;
      }
      
      // Si es un artículo nuevo (no existe duplicado), mostrar notificación
      showBarcodeNotification(nombreSel, items[idx].cantidad, false);
    }
    
    // Usar función auxiliar para actualizar todos los campos consistentemente
    actualizarCamposArticulo(items[idx], nombreSel);
    
    // Batch DOM updates para mejor rendimiento
    requestAnimationFrame(() => {
      // Actualizar interfaz en una sola operación
      const updates = {
        codigo: items[idx].codigo,
        valorU: items[idx].valorU,
        valorTotal: (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0})
      };
      
      row.querySelector('.codigo').value = updates.codigo;
      row.querySelector('.valorU').value = updates.valorU;
      row.querySelector('.valorTotal').textContent = updates.valorTotal;
      
      // Actualizar imagen del artículo de forma optimizada
      updateRowImage(row, nombreSel);
      
      // Usar debounce para cálculos (ya optimizado)
      debouncedCalculations();
      
      // Enfocar campo cantidad después del render
      setTimeout(() => {
        const cantidadInput = row.querySelector('.cantidad');
        if (cantidadInput) {
          cantidadInput.focus();
          const val = cantidadInput.value;
          if (cantidadInput.type !== 'number') {
            cantidadInput.setSelectionRange(val.length, val.length);
          }
        }
      }, 0);
    });
  }
  
  // === FUNCIÓN AUXILIAR PARA ACTUALIZAR IMAGEN DE FILA ===
  function updateRowImage(row, nombreSel) {
    const imgCell = row.querySelector('td:first-child');
    const primeraImagen = obtenerPrimeraImagen(nombreSel);
    
    if (primeraImagen) {
      imgCell.innerHTML = `<img src="${primeraImagen}" class="articulo-img" style="width:50px;height:50px;object-fit:cover;border-radius:4px;cursor:pointer;" alt="Imagen del artículo" onerror="this.style.display='none'">`;
      const imgElement = imgCell.querySelector('.articulo-img');
      if (imgElement) {
        // Crear hover de forma asíncrona
        requestAnimationFrame(() => {
          crearHoverImagen(imgElement, primeraImagen);
        });
      }
    } else {
      imgCell.innerHTML = '<span style="color:#ccc;">Sin img</span>';
    }
  }

  // === OPTIMIZACIÓN: REMOVER ITEM SIN RE-RENDERIZAR TODO ===
  function removeItem(idx) {
    items.splice(idx, 1);
    
    // Remover la fila del DOM
    const rowToRemove = itemsBody.querySelector(`tr[data-idx="${idx}"]`);
    if (rowToRemove) {
      // Limpiar event listeners y Select2 antes de remover
      try {
        const select = rowToRemove.querySelector('.nombre-select');
        if (select && $(select).hasClass('select2-hidden-accessible')) {
          $(select).select2('destroy');
        }
      } catch (e) {
        // Silenciar errores de destrucción
      }
      
      rowToRemove.remove();
    }
    
    // Actualizar índices en las filas restantes de forma optimizada
    const remainingRows = itemsBody.querySelectorAll('tr[data-idx]');
    const updateBatch = [];
    
    remainingRows.forEach((row) => {
      const currentIdx = parseInt(row.getAttribute('data-idx'));
      if (currentIdx > idx) {
        const newIdx = currentIdx - 1;
        updateBatch.push({
          row,
          newIdx,
          select: row.querySelector('.nombre-select'),
          removeBtn: row.querySelector('.remove-btn')
        });
      }
    });
    
    // Aplicar actualizaciones en batch
    requestAnimationFrame(() => {
      updateBatch.forEach(({ row, newIdx, select, removeBtn }) => {
        row.setAttribute('data-idx', newIdx);
        if (select) select.setAttribute('data-idx', newIdx);
        if (removeBtn) removeBtn.setAttribute('data-idx', newIdx);
      });
      
      debouncedCalculations();
    });
  }

  // === DEBOUNCE PARA CÁLCULOS ===
  let calculationTimeout;
  function debouncedCalculations() {
    clearTimeout(calculationTimeout);
    calculationTimeout = setTimeout(() => {
      // Limpiar cache de costos
      costosCache = null;
      lastItemsHash = '';
      
      updateSubtotal();
      calcularTotalFinal();
      actualizarContadoresArticulos();
      debouncedRecargoUpdate();
    }, 50);
  }

  // === OPTIMIZACIÓN: ACTUALIZAR SOLO SUBTOTAL ===
  function updateSubtotal() {
    const subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
    subtotalInput.value = subtotal.toLocaleString('es-AR', {maximumFractionDigits:0});
  }

  function renderItems() {
    // Limpiar cache al re-renderizar por completo
    articulosOrdenadosCache = null;
    optionsHtmlCache = '';
    costosCache = null;
    lastItemsHash = '';
    
    // Limpiar hovers existentes antes de renderizar
    cleanupAllHovers();
    
    itemsBody.innerHTML = '';
    
    // Usar DocumentFragment para mejor rendimiento
    const fragment = document.createDocumentFragment();
    const setupTasks = []; // Array para tareas asíncronas
    
    items.forEach((item, idx) => {
      const row = createRowElement(item, idx);
      fragment.appendChild(row);
      
      // Guardar tarea de configuración para ejecutar después
      setupTasks.push({
        row,
        idx,
        shouldOpenSelect: idx === items.length - 1 && window._abrirSelect2NuevaFila,
        item
      });
    });
    
    itemsBody.appendChild(fragment);
    
    // Procesar configuraciones en chunks para no bloquear la UI
    function processSetupChunk(startIdx = 0) {
      const chunkSize = 3; // Procesar de a 3 filas por chunk
      const endIdx = Math.min(startIdx + chunkSize, setupTasks.length);
      
      for (let i = startIdx; i < endIdx; i++) {
        const task = setupTasks[i];
        const { select } = setupRowEventListeners(task.row, task.idx);
        
        // Configurar Select2 si es necesario
        if (task.shouldOpenSelect) {
          setTimeout(() => {
            try {
              select.select2('open');
              setTimeout(() => {
                const $search = $('.select2-container--open .select2-search__field');
                if ($search.length) $search[0].focus();
              }, 50);
            } catch (e) {
              console.warn('Error abriendo Select2:', e);
            }
          }, 100);
        }
        
        // Actualizar campos si hay artículo seleccionado
        if (task.item.nombre && articulosPorNombre[task.item.nombre]) {
          const cantidadOriginal = task.item.cantidad;
          const valorUOriginal = task.item.valorU;
          actualizarCamposArticulo(task.item, task.item.nombre);
          
          if (cantidadOriginal) task.item.cantidad = cantidadOriginal;
          if (valorUOriginal) task.item.valorU = valorUOriginal;
          
          task.item.valorG = (task.item.valorU - task.item.valorC) * (task.item.cantidad || 1);
          
          task.row.querySelector('.valorU').value = task.item.valorU;
          task.row.querySelector('.valorTotal').textContent = (task.item.cantidad * task.item.valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
        }
      }
      
      // Si hay más tareas, procesarlas en el siguiente frame
      if (endIdx < setupTasks.length) {
        requestAnimationFrame(() => processSetupChunk(endIdx));
      } else {
        // Todas las tareas completadas, ejecutar cálculos finales
        debouncedCalculations();
      }
    }
    
    // Iniciar procesamiento asíncrono
    requestAnimationFrame(() => processSetupChunk());
  }

  // === FUNCIÓN PARA ACTUALIZAR CONTADORES DE ARTÍCULOS ===
  function actualizarContadoresArticulos() {
    const contadoresElement = document.getElementById('contadoresArticulos');
    const cantidadArticulosElement = document.getElementById('cantidadArticulos');
    const cantidadUnidadesElement = document.getElementById('cantidadUnidades');
    
    if (!contadoresElement || !cantidadArticulosElement || !cantidadUnidadesElement) return;
    
    // Filtrar artículos que tienen nombre (están seleccionados)
    const articulosConNombre = items.filter(item => item.nombre && item.nombre.trim() !== '');
    
    if (articulosConNombre.length === 0) {
      // No hay artículos, ocultar contadores
      contadoresElement.style.display = 'none';
    } else {
      // Calcular cantidades
      const cantidadArticulosDistintos = articulosConNombre.length;
      const cantidadUnidadesTotales = articulosConNombre.reduce((total, item) => total + (item.cantidad || 0), 0);
      
      // Actualizar textos
      cantidadArticulosElement.textContent = `Artículos distintos: ${cantidadArticulosDistintos}`;
      cantidadUnidadesElement.textContent = `Unidades totales: ${cantidadUnidadesTotales}`;
      
      // Mostrar contadores con flex para alineación horizontal
      contadoresElement.style.display = 'flex';
    }
  }

  // Formateo numérico para todos los campos relacionados a valores
  function calcularTotalFinal() {
    let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
    let recargo = parseInt((recargoInput.value || '0').replace(/\D/g, '')) || 0;
    let descuento = parseInt((descuentoInput.value || '0').replace(/\D/g, '')) || 0;
    let envio = parseInt((envioInput.value || '0').replace(/\D/g, '')) || 0;
    // Si hay porcentaje, calcular descuento automáticamente
    if (descuentoPorcentajeInput && descuentoPorcentajeInput.value.trim() !== '') {
      let porcentaje = descuentoPorcentajeInput.value.replace(/[^\d.]/g, '');
      porcentaje = parseFloat(porcentaje);
      if (!isNaN(porcentaje) && porcentaje > 0) {
        descuento = Math.round(subtotal * (porcentaje / 100));
        // Actualizar el campo descuento visualmente aunque esté vacío inicialmente
        if (descuentoInput) {
          descuentoInput.value = descuento.toLocaleString('es-AR', {maximumFractionDigits:0});
        }
      } else {
        if (descuentoInput) {
          descuentoInput.value = '';
        }
      }
    }
    let total = subtotal + recargo + envio - descuento;
    // Usar punto como separador de miles para todos los campos
    const formatMiles = n => n ? n.toLocaleString('es-AR').replace(/,/g, '.').replace(/\./g, (m, o, s) => s && s.length > 3 ? '.' : '.') : '';
    subtotalInput.value = formatMiles(subtotal);
    recargoInput.value = recargo ? formatMiles(recargo) : '';
    descuentoInput.value = descuento ? formatMiles(descuento) : '';
    envioInput.value = envio ? formatMiles(envio) : '';
    totalFinalInput.value = formatMiles(total);
  }


  // === OPTIMIZACIÓN: AGREGAR ITEM SIN RE-RENDERIZAR TODO ===
  function addNewItem() {
    // Si hay al menos un artículo y el último no tiene nombre seleccionado, no permitir agregar otro
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      if (!lastItem.nombre) {
        showPopup('Debe seleccionar un artículo antes de agregar una nueva fila.', '❗', false);
        return;
      }
    }
    
    const newItem = { codigo: '', codigoBarras: '', nombre: '', cantidad: 1, valorU: 0, valorC: 0, categoria: '', seleccionado: '', valorG: 0 };
    items.push(newItem);
    
    const newIdx = items.length - 1;
    const row = createRowElement(newItem, newIdx);
    itemsBody.appendChild(row);
    
    // Configurar event listeners para la nueva fila de forma asíncrona
    requestAnimationFrame(() => {
      const { select } = setupRowEventListeners(row, newIdx);
      
      // Abrir Select2 automáticamente con delay optimizado
      setTimeout(() => {
        try {
          select.select2('open');
          setTimeout(() => {
            const $search = $('.select2-container--open .select2-search__field');
            if ($search.length) $search[0].focus();
          }, 100);
        } catch (e) {
          console.warn('Error abriendo Select2 en nueva fila:', e);
        }
      }, 150);
      
      // Cálculos después de configurar
      debouncedCalculations();
    });
  }

  // === SCANNER DE CÓDIGO DE BARRAS ===
  function initializeBarcodeScanner() {
    if (!barcodeInput || !barcodeStatus) return;
    
    let scanTimeout;
    let isScanning = false;
    
    // Configurar estado inicial
    showBarcodeStatus('ready');
    
    
    // También procesar al presionar Enter
    barcodeInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(scanTimeout);
        const value = e.target.value.trim();
        if (value.length > 0) {
          processBarcodeInput(value);
        }
      }
    });
    
    // Auto-focus al campo cuando se hace clic en el área del scanner
    const scannerArea = document.getElementById('barcodeScanner');
    if (scannerArea) {
      scannerArea.addEventListener('click', function() {
        barcodeInput.focus();
      });
    }
    
    // Validar campo de cantidad - solo números positivos
    if (barcodeQuantity) {
      barcodeQuantity.addEventListener('input', function() {
        let value = parseInt(this.value) || 1;
        if (value < 1) value = 1;
        if (value > 999) value = 999;
        this.value = value;
      });
      
      // Seleccionar todo el texto al hacer focus para fácil edición
      barcodeQuantity.addEventListener('focus', function() {
        this.select();
      });
    }
  }
  
  function processBarcodeInput(barcode) {
    if (!barcode || barcode.length < 3) {
      showBarcodeStatus('error', 'Código muy corto');
      clearBarcodeInput();
      return;
    }
    
    // Obtener cantidad especificada (por defecto 1)
    const cantidadEspecificada = barcodeQuantity ? (parseInt(barcodeQuantity.value) || 1) : 1;
    
    // Buscar artículo por código
    const articulo = articulosPorCodigo[barcode];
    
    if (!articulo) {
      showBarcodeStatus('error', 'Código no encontrado');
      showPopup(`❌ Código de barras "${barcode}" no encontrado en el inventario.`, '❌', false);
      clearBarcodeInput();
      return;
    }
    
    // Verificar disponibilidad
    if (articulo[4]?.toLowerCase() === 'no disponible') {
      showBarcodeStatus('error', 'Artículo no disponible');
      showPopup(`⚠️ El artículo "${articulo[3]}" no está disponible.`, '⚠️', false);
      clearBarcodeInput();
      return;
    }
    
    // Verificar si el artículo ya existe en la lista
    const existingItemIndex = items.findIndex(item => item.nombre === articulo[3]);
    
    if (existingItemIndex !== -1) {
      // Incrementar cantidad del artículo existente por la cantidad especificada
      items[existingItemIndex].cantidad += cantidadEspecificada;
      
      // Actualizar la fila visualmente
      const existingRow = itemsBody.querySelector(`tr[data-idx="${existingItemIndex}"]`);
      if (existingRow) {
        const cantidadInput = existingRow.querySelector('.cantidad');
        const valorTotalCell = existingRow.querySelector('.valorTotal');
        
        if (cantidadInput) {
          cantidadInput.value = items[existingItemIndex].cantidad;
        }
        
        if (valorTotalCell) {
          const valorTotal = items[existingItemIndex].cantidad * items[existingItemIndex].valorU;
          valorTotalCell.textContent = valorTotal.toLocaleString('es-AR', {maximumFractionDigits:0});
        }
        
        // Actualizar valorG
        if (items[existingItemIndex].valorC) {
          items[existingItemIndex].valorG = (items[existingItemIndex].valorU - items[existingItemIndex].valorC) * items[existingItemIndex].cantidad;
        }
        
        // Highlight temporal de la fila
        existingRow.style.backgroundColor = '#e8f5e8';
        setTimeout(() => {
          existingRow.style.backgroundColor = '';
        }, 1500);
      }
      
      // Mostrar información del código específico escaneado
      const codigosDisponibles = articulo[11] ? articulo[11].split(',').map(c => c.trim()).filter(c => c) : [];
      const esMultipleCodigo = codigosDisponibles.length > 1;
      const infoCodigoExtra = esMultipleCodigo ? ` (Código: ${barcode})` : '';
      
      showBarcodeStatus('success', `+${cantidadEspecificada} ${articulo[3]}`);
      // Mostrar notificación con imagen del artículo
      showBarcodeNotification(articulo[3], items[existingItemIndex].cantidad, true);
    } else {
      // Agregar nuevo artículo usando la misma lógica que el método manual
      const newItem = {
        codigo: '',
        codigoBarras: '',
        nombre: articulo[3] || '', // Solo asignar el nombre inicialmente
        cantidad: cantidadEspecificada,
        valorU: 0,
        valorC: 0,
        categoria: '',
        seleccionado: '',
        valorG: 0
      };
      
      // Usar la función existente para actualizar todos los campos correctamente
      actualizarCamposArticulo(newItem, articulo[3]);
      
      // Restaurar la cantidad especificada (que podría haber sido sobrescrita)
      newItem.cantidad = cantidadEspecificada;
      
      // Recalcular valorG con la cantidad correcta
      newItem.valorG = (newItem.valorU - newItem.valorC) * newItem.cantidad;
      
      items.push(newItem);
      const newIdx = items.length - 1;
      const row = createRowElement(newItem, newIdx);
      itemsBody.appendChild(row);
      
      // Configurar event listeners para la nueva fila
      setupRowEventListeners(row, newIdx);
      
      // Highlight temporal de la nueva fila
      row.style.backgroundColor = '#e8f5e8';
      setTimeout(() => {
        row.style.backgroundColor = '';
      }, 1500);
      
      // Mostrar información del código específico escaneado
      const codigosDisponibles = articulo[11] ? articulo[11].split(',').map(c => c.trim()).filter(c => c) : [];
      const esMultipleCodigo = codigosDisponibles.length > 1;
      const infoCodigoExtra = esMultipleCodigo ? ` (Código: ${barcode})` : '';
      
      showBarcodeStatus('success', `Agregado: ${articulo[3]}`);
      // Mostrar notificación con imagen del artículo
      showBarcodeNotification(articulo[3], cantidadEspecificada, false);
    }
    
    // Recalcular totales
    debouncedCalculations();
    
    // Limpiar input y restablecer cantidad para el próximo escaneo
    setTimeout(() => {
      clearBarcodeInput();
      resetBarcodeQuantity();
    }, 1000);
  }
  
  function showBarcodeStatus(type, message = '') {
    if (!barcodeStatus) return;
    
    barcodeStatus.innerHTML = '';
    
    switch (type) {
      case 'ready':
        barcodeStatus.innerHTML = '🔍';
        barcodeStatus.style.color = '#6c757d';
        barcodeStatus.title = 'Listo para escanear';
        break;
      case 'scanning':
        barcodeStatus.innerHTML = '⏳';
        barcodeStatus.style.color = '#007bff';
        barcodeStatus.title = 'Escaneando...';
        break;
      case 'success':
        barcodeStatus.innerHTML = '✅';
        barcodeStatus.style.color = '#28a745';
        barcodeStatus.title = message || 'Artículo encontrado';
        setTimeout(() => showBarcodeStatus('ready'), 2000);
        break;
      case 'error':
        barcodeStatus.innerHTML = '❌';
        barcodeStatus.style.color = '#dc3545';
        barcodeStatus.title = message || 'Error en escaneo';
        setTimeout(() => showBarcodeStatus('ready'), 3000);
        break;
    }
  }
  
  function clearBarcodeInput() {
    if (barcodeInput) {
      barcodeInput.value = '';
    }
  }
  
  function resetBarcodeQuantity() {
    if (barcodeQuantity) {
      barcodeQuantity.value = 1;
    }
  }

  // === FUNCIÓN PARA MOSTRAR NOTIFICACIÓN CON IMAGEN (TOAST) ===
  function showBarcodeNotification(nombreArticulo, cantidad, isIncrement = false) {
    // Obtener imagen del artículo
    const imagenUrl = obtenerPrimeraImagen(nombreArticulo);
    
    // Remover notificación anterior si existe
    const oldNotif = document.getElementById('barcodeToast');
    if (oldNotif) oldNotif.remove();
    
    // Crear contenedor de notificación
    const toast = document.createElement('div');
    toast.id = 'barcodeToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      padding: 16px;
      z-index: 10000;
      min-width: 320px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
      border-left: 4px solid #28a745;
    `;
    
    // Crear contenido
    const imageHtml = imagenUrl ? 
      `<img src="${imagenUrl}" 
            style="width: 100%; height: 350px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;" 
            alt="${nombreArticulo}"
            onerror="this.style.display='none'">` : '';
    
    const cantidadText = cantidad > 1 ? ` (${cantidad} unidades)` : '';
    const accionText = isIncrement ? '✅ Cantidad actualizada' : '✅ Artículo agregado';
    
    toast.innerHTML = `
      ${imageHtml}
      <div style="font-weight: 600; font-size: 14px; color: #28a745; margin-bottom: 6px;">
        ${accionText}
      </div>
      <div style="font-size: 15px; color: #333; font-weight: 500;">
        ${nombreArticulo}${cantidadText}
      </div>
    `;
    
    // Agregar estilos de animación
    if (!document.getElementById('barcodeToastStyles')) {
      const style = document.createElement('style');
      style.id = 'barcodeToastStyles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Cerrar al hacer clic
    toast.addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    });
    
    // Auto-cerrar después de 4 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

addItemBtn.addEventListener('click', addNewItem);

  // === OPTIMIZACIÓN: EVENT DELEGATION PARA INPUTS ===
  itemsBody.addEventListener('input', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    
    const idx = parseInt(row.getAttribute('data-idx'));
    if (idx < 0 || idx >= items.length) return;
    
    const target = e.target;
    let needsRecalculation = false;
    
    // Actualizar solo el campo específico que cambió
    if (target.classList.contains('codigo')) {
      items[idx].codigo = target.value;
    } else if (target.classList.contains('cantidad')) {
      const newCantidad = parseInt(target.value) || 1;
      if (items[idx].cantidad !== newCantidad) {
        items[idx].cantidad = newCantidad;
        needsRecalculation = true;
        
        // Actualizar valorG si hay artículo válido
        if (items[idx].nombre && articulosPorNombre[items[idx].nombre]) {
          items[idx].valorG = (items[idx].valorU - items[idx].valorC) * items[idx].cantidad;
        }
        
        // Actualizar valor total de la fila
        row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
      }
    } else if (target.classList.contains('valorU')) {
      const valorUraw = target.value.replace(/,/g, '');
      const newValorU = parseInt(valorUraw) || 0;
      if (items[idx].valorU !== newValorU) {
        items[idx].valorU = newValorU;
        needsRecalculation = true;
        
        // Actualizar valorG si hay artículo válido
        if (items[idx].nombre && articulosPorNombre[items[idx].nombre]) {
          items[idx].valorG = (items[idx].valorU - items[idx].valorC) * items[idx].cantidad;
        }
        
        // Actualizar valor total de la fila
        row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
      }
    }
    
    // Solo recalcular si realmente cambió algo importante
    if (needsRecalculation) {
      debouncedCalculations();
    }
  });

  [recargoInput, descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', function() {
      // Normalizar y formatear
      let val = this.value.replace(/\D/g, '');
      // Formatear con punto como separador de miles
      this.value = val ? Number(val).toLocaleString('es-AR').replace(/,/g, '.') : '';
      calcularTotalFinal();
    });
  });

  // Nuevo: actualizar descuento automáticamente al cambiar el porcentaje
  if (typeof descuentoPorcentajeInput !== 'undefined' && descuentoPorcentajeInput) {
    descuentoPorcentajeInput.addEventListener('input', function() {
      calcularTotalFinal();
    });
  }

  // Si el usuario edita el campo descuento manualmente, limpiar el campo porcentaje
  if (typeof descuentoInput !== 'undefined' && descuentoInput) {
    descuentoInput.addEventListener('input', function() {
      if (typeof descuentoPorcentajeInput !== 'undefined' && descuentoPorcentajeInput && descuentoInput.value.trim() !== '') {
        descuentoPorcentajeInput.value = '';
      }
      calcularTotalFinal();
    });
  }

  form.addEventListener('reset', function() {
    // Limpiar recursos antes del reset
    cleanupAllHovers();
    
    // Destruir todos los Select2 antes de limpiar
    itemsBody.querySelectorAll('.nombre-select').forEach(select => {
      try {
        if ($(select).hasClass('select2-hidden-accessible')) {
          $(select).select2('destroy');
        }
      } catch (e) {
        // Silenciar errores de destrucción
      }
    });
    
    items = [];
    setTimeout(() => {
      renderItems();
      messageDiv.textContent = '';
      subtotalInput.value = '';
      totalFinalInput.value = '';
    }, 0);
  });

  // --- MODAL DE CONFIRMACIÓN PARA IMPRIMIR ---
  function mostrarModalImprimirOrden(onSi, onNo) {
    // Eliminar modal previo si existe
    const old = document.getElementById('modalImprimirOrden');
    if (old) old.remove();
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'modalImprimirOrden';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    // Modal box
    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '32px 24px 20px 24px';
    box.style.borderRadius = '10px';
    box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
    box.style.textAlign = 'center';
    box.innerHTML = `
      <div style="font-size:1.2em;margin-bottom:18px;">¿Desea imprimir la Orden de pedido?</div>
      <button id="btnImprimirSi" style="background:#6c4eb6;color:#fff;padding:8px 24px;margin:0 12px;border:none;border-radius:4px;font-size:1em;">Sí</button>
      <button id="btnImprimirNo" style="background:#aaa;color:#fff;padding:8px 24px;margin:0 12px;border:none;border-radius:4px;font-size:1em;">No</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // Eventos
    function keyHandler(e) {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Enter') {
        box.querySelector('#btnImprimirSi').click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        box.querySelector('#btnImprimirNo').click();
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', keyHandler);
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    box.querySelector('#btnImprimirSi').onclick = () => {
      overlay.remove();
      cleanup();
      onSi();
    };
    box.querySelector('#btnImprimirNo').onclick = () => {
      overlay.remove();
      cleanup();
      onNo();
    };
  }

  // --- SUBMIT GLOBAL SOLO PARA ALTAS ---
  form.addEventListener('submit', function(e) {
    if (pedidoId) return; // Si es edición, no ejecutar alta
    e.preventDefault();
    ingresarPedido();
  });

  // Extraer la lógica de ingreso de pedido a una función reutilizable
  function ingresarPedido() {
    // Validar campos obligatorios
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const medioPago = form.medioPago.value;
    const vendedor = form.vendedor ? form.vendedor.value.trim() : '';
    const tipoClienteRadio = document.querySelector('input[name="tipoCliente"]:checked');
    const tipoCliente = tipoClienteRadio ? tipoClienteRadio.value : '';

    if (!nombre) {
      showPopup('Debe completar el campo Nombre de cliente.', '❗', false);
      return;
    }
    if (!tipoCliente) {
      showPopup('Debe seleccionar el Tipo de Cliente.', '❗', false);
      return;
    }
    if (!medioPago) {
      showPopup('Debe seleccionar el Medio de Pago.', '❗', false);
      return;
    }
    // Validar ALIAS si el medio de pago es Transferencia o Parcial
    if (medioPago === 'Transferencia' || medioPago === 'Parcial') {
      const alias = form.alias ? form.alias.value.trim().toUpperCase() : '';
      if (!alias) {
        showPopup('Debe completar el campo ALIAS para transferencias y pagos parciales.', '❗', false);
        return;
      }
    }
    if (!vendedor) {
      showPopup('Debe completar el campo Vendedor.', '❗', false);
      return;
    }

    // Procesar y guardar subtotal y total como enteros (solo dígitos)
    function onlyDigits(str) {
      return (str + '').replace(/\D/g, '');
    }
    const recargo = parseInt(onlyDigits(form.recargo.value), 10) || 0;
    const descuento = parseInt(onlyDigits(form.descuento.value), 10) || 0;
    const envio = parseInt(onlyDigits(form.envio.value), 10) || 0;
    const subtotal = parseInt(onlyDigits(form.subtotal.value), 10) || 0;
    const totalFinal = parseInt(onlyDigits(form.totalFinal.value), 10) || 0;
    const nota = form.nota ? form.nota.value.trim() : '';
    const alias = form.alias ? form.alias.value.trim().toUpperCase() : '';

    if (items.length === 0) {
      showPopup('Debe agregar al menos un artículo.', '❗', false);
      return;
    }
    // Validar artículos
    for (const item of items) {
      if (!item.nombre || item.cantidad <= 0 || item.valorU < 0) {
        showPopup('Complete correctamente los datos de los artículos.', '❗', false);
        return;
      }
      
      // FORZAR ACTUALIZACIÓN de todos los campos desde Google Sheets antes de guardar
      if (item.nombre && articulosPorNombre[item.nombre]) {
        const art = articulosPorNombre[item.nombre];
        // Forzar actualización de codigo, codigoBarras, categoria y seleccionado
        item.codigo = art[2] || '';
        item.codigoBarras = art[11] || '';
        item.categoria = art[0] || '';
        item.seleccionado = art[9] || '';
        // Forzar actualización de valorC
        let valorCRaw = art[7] || '0';
        valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        item.valorC = parseInt(valorCRaw) || 0;
      } else {
        // Si no hay artículo válido, limpiar campos
        item.codigo = '';
        item.codigoBarras = '';
        item.categoria = '';
        item.seleccionado = '';
        item.valorC = 0;
      }
      
      // Asegurar que valorC nunca sea undefined (fallback adicional)
      if (typeof item.valorC === 'undefined' || item.valorC === null) {
        item.valorC = 0;
      }
      
      // Calcular valorG
      item.valorG = (item.valorU - item.valorC) * (item.cantidad || 1);
    }
    // Obtener cotización blue en tiempo real
    fetch('https://api.bluelytics.com.ar/v2/latest')
      .then(r => r.json())
      .then(d => {
        if (!d.blue || (typeof d.blue.value_sell === 'undefined' && typeof d.blue.sell === 'undefined')) {
          throw new Error('cotizacion');
        }
        let cotizacionCierre = (d.blue.value_sell || d.blue.sell);
        // Construir objeto pedido
        const costos = calcularCostos();
        // Determinar tipo de entrega
        let entrega = 'Local';
        if (direccion && direccion.length > 3) {
          entrega = 'Envios';
        }

        // Obtener fecha de creación solo al crear el pedido
        function getFechaActual() {
          const now = new Date();
          const pad = n => n.toString().padStart(2, '0');
          return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        }

        // Calcular gananciaSelec: suma de valorG de los artículos seleccionados
        const gananciaSelec = items
          .filter(it => it.seleccionado && it.seleccionado.toUpperCase() === 'SI')
          .reduce((acc, it) => acc + (parseInt(it.valorG) || 0), 0);
        const pedidoObj = {
          timestamp: Date.now(),
          locked: true,
          adminViewed: true,
          cliente: { nombre, telefono, direccion, dni, email, tipoCliente },
          items: items.map(it => ({ codigo: it.codigo, codigoBarras: it.codigoBarras, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC, categoria: it.categoria, seleccionado: it.seleccionado, valorG: it.valorG })),
          pagos: {
            medioPago,
            recargo,
            descuento,
            envio,
            subtotal,
            totalFinal,
            costos,
            ganancia: subtotal - costos - descuento,
            gananciaSelec,
            alias
          },
          status: 'DESPACHADO/ENTREGADO',
          cotizacionCierre: cotizacionCierre,
          costoUSD: costos / cotizacionCierre,
          createdby: 'admin',
          entrega,
          nota,
          vendedor,
        };
        // Guardar en Firebase
        if (pedidoId) {
          db.ref('pedidos/' + pedidoId).once('value').then(snap => {
            const pedidoAnterior = snap.val();
            // CONSERVAR lastOrderUpdate si existe
            if (pedidoAnterior && pedidoAnterior.lastOrderUpdate) {
              pedidoObj.lastOrderUpdate = pedidoAnterior.lastOrderUpdate;
            }
            // CONSERVAR fecha original si existe
            if (pedidoAnterior && pedidoAnterior.fecha) {
              pedidoObj.fecha = pedidoAnterior.fecha;
            }
            db.ref('pedidos/' + pedidoId).set(pedidoObj)
              .then(() => {
                // Registrar movimientos de inventario también en edición
                registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoId);
                messageDiv.textContent = 'Pedido actualizado correctamente.';
                messageDiv.style.color = 'green';
                setTimeout(() => {
                  if (window.opener && !window.opener.closed) {
                    window.opener.location.reload();
                    window.close();
                  } else {
                    window.location.href = 'ingresoPedido.html';
                  }
                }, 1200);
              })
              .catch(err => {
                messageDiv.textContent = 'Error al actualizar el pedido.';
                messageDiv.style.color = 'red';
              });
          });
        } else {

          // Agregar campo fecha solo al crear el pedido
          pedidoObj.fecha = getFechaActual();
          // Usar push para obtener el id generado
          const pedidoRef = db.ref('pedidos').push();
          pedidoRef.set(pedidoObj)
            .then(() => {
              // Registrar movimientos de inventario usando el id generado
              registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoRef.key);
              // Actualizar historial de alias si se usó uno
              if (pedidoObj.pagos && pedidoObj.pagos.alias && pedidoObj.pagos.alias.trim() !== '') {
                cargarHistorialAlias();
              }
              // Mostrar modal de impresión DESPUÉS de guardar exitosamente
              mostrarModalImprimirOrden(
                function() { // Sí imprimir
                  generarReciboYImprimir();
                  showPopup('Pedido ingresado', '✅', true);
                  form.reset();
                  items = [];
                  renderItems();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                },
                function() { // No imprimir
                  showPopup('Pedido ingresado', '✅', true);
                  form.reset();
                  items = [];
                  renderItems();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              );
            })
            .catch(err => {
              showPopup('Error al guardar el pedido.', '❌', false);
            });
        }
      })
      .catch(err => {
        if (err && err.message === 'cotizacion') {
          showPopup('No se pudo obtener la cotización del dólar blue.', '❌', false);
        } else {
          showPopup('Ocurrió un error inesperado al guardar el pedido.', '❌', false);
        }
      });
  }

  // --- POPUP MODAL ---
  function showPopup(message, emoji, autoClose, imageUrl = null) {
    // Remove existing popup if any
    const old = document.getElementById('popupPedidoMsg');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'popupPedidoMsg';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';
    
    // Crear imagen si se proporciona URL
    const imageHtml = imageUrl ? `
      <div style="margin-bottom: 16px;">
     <img src="${imageUrl}" 
       style="width: 250px; height: 250px; object-fit: cover; border-radius: 8px; border: 2px solid #e0e0e0;" 
       alt="Imagen del artículo"
       onerror="this.style.display='none'">
      </div>
    ` : '';
    
    overlay.innerHTML = `
      <div style="background:#fff;padding:32px 24px;border-radius:16px;box-shadow:0 4px 32px #0002;min-width:320px;max-width:90vw;display:flex;flex-direction:column;align-items:center;">
        ${imageHtml}
        <div style="font-size:3rem;">${emoji}</div>
        <div style="font-size:1.3rem;margin:18px 0 10px 0;text-align:center;">${message}</div>
        <button id="popupPedidoOk" style="margin-top:10px;background:#6c4eb6;color:#fff;padding:8px 32px;border:none;border-radius:6px;font-size:1.1rem;cursor:pointer;">Ok</button>
      </div>
    `;
    document.body.appendChild(overlay);
    // Close on Ok
    overlay.querySelector('#popupPedidoOk').onclick = function() {
      overlay.remove();
    };
    // Close on click outside
    overlay.onclick = function(e) {
      if (e.target === overlay) overlay.remove();
    };
    // Optional auto close
    if (autoClose) {
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 5000);
    }
    // Soporte Enter/Escape
    function keyHandler(e) {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Enter' || e.key === 'Escape') {
        overlay.remove();
        cleanup();
        e.preventDefault();
      }
    }
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    document.addEventListener('keydown', keyHandler);
  }

  // === SOPORTE EDICIÓN DE PEDIDOS ===
  // Si hay un parámetro id en la URL, cargar el pedido y rellenar el formulario para editar
  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get('id');
  if (pedidoId) {
    db.ref('pedidos/' + pedidoId).once('value').then(snap => {
      const pedido = snap.val();
      if (!pedido) return;
      // Rellenar datos del cliente
      form.nombre.value = pedido.cliente?.nombre || '';
      form.telefono.value = pedido.cliente?.telefono || '';
      form.direccion.value = pedido.cliente?.direccion || '';
      form.dni.value = pedido.cliente?.dni || '';
      form.email.value = pedido.cliente?.email || '';
      // Rellenar tipo de cliente si existe
      if (pedido.cliente?.tipoCliente) {
        const radio = document.querySelector(`input[name="tipoCliente"][value="${pedido.cliente.tipoCliente}"]`);
        if (radio) {
          radio.checked = true;
          tipoCliente = pedido.cliente.tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
          // Forzar actualización de valores de artículos según tipoCliente
          items.forEach((item, idx) => {
            if (item.nombre && articulosPorNombre[item.nombre]) {
              const art = articulosPorNombre[item.nombre];
              let valorRaw = tipoCliente === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
              valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
              items[idx].valorU = parseInt(valorRaw) || 0;
            }
          });
        }
      }
      // Rellenar items
      items = (pedido.items || []).map(it => ({
        codigo: it.codigo || '',
        codigoBarras: it.codigoBarras || '',
        nombre: it.nombre || '',
        cantidad: it.cantidad || 1,
        valorU: it.valorU || 0,
        valorC: typeof it.valorC !== 'undefined' ? it.valorC : 0,
        categoria: typeof it.categoria !== 'undefined' ? it.categoria : '',
        seleccionado: typeof it.seleccionado !== 'undefined' ? it.seleccionado : (it.nombre && articulosPorNombre[it.nombre] ? articulosPorNombre[it.nombre][8] || '' : ''),
        valorG: typeof it.valorG !== 'undefined' ? it.valorG : (typeof it.valorU !== 'undefined' && typeof it.valorC !== 'undefined' ? it.valorU - it.valorC : 0)
      }));
      renderItems();
      // Rellenar pagos
      form.medioPago.value = pedido.pagos?.medioPago || '';
      form.recargo.value = pedido.pagos?.recargo ? Number(String(pedido.pagos.recargo).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.descuento.value = pedido.pagos?.descuento ? Number(String(pedido.pagos.descuento).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.envio.value = pedido.pagos?.envio ? Number(String(pedido.pagos.envio).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      // Mostrar subtotal y total como enteros con separador de miles
      form.subtotal.value = pedido.pagos?.subtotal ? parseInt((pedido.pagos.subtotal + '').replace(/\D/g, ''), 10).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.totalFinal.value = pedido.pagos?.totalFinal ? parseInt((pedido.pagos.totalFinal + '').replace(/\D/g, ''), 10).toLocaleString('es-AR').replace(/,/g, '.') : '';
      // Autocompletar nota y vendedor si existen
      if (form.nota) form.nota.value = pedido.nota || '';
      if (form.vendedor) form.vendedor.value = pedido.vendedor || '';
      if (form.alias) form.alias.value = pedido.pagos?.alias || '';

      // --- SOLO LECTURA SI STATUS ES CANCELADO ---
      if (pedido.status === 'CANCELADO') {
        // Eliminar movimientos de inventario asociados a este pedido cancelado
        if (pedidoId) {
          db.ref('movimientos').orderByChild('pedidoId').equalTo(pedidoId).once('value', function(snapshot) {
            const updates = {};
            snapshot.forEach(child => {
              updates[child.key] = null;
            });
            if (Object.keys(updates).length > 0) {
              db.ref('movimientos').update(updates).catch(err => {
                console.error('Error eliminando movimientos por cancelación:', err, updates);
              });
            }
          });
        }
        // Deshabilitar todos los campos del formulario
        Array.from(form.elements).forEach(el => {
          el.disabled = true;
        });
        // Deshabilitar selects y radios fuera del form (por si acaso)
        document.querySelectorAll('input[type="radio"], select').forEach(el => {
          el.disabled = true;
        });
        // Deshabilitar botones de acción
        document.querySelectorAll('button, input[type="button"]').forEach(btn => {
          btn.disabled = true;
        });
        // Mostrar mensaje de solo lectura
        let lockedMsg = document.getElementById('lockedMsg');
        if (!lockedMsg) {
          lockedMsg = document.createElement('div');
          lockedMsg.id = 'lockedMsg';
          lockedMsg.textContent = 'Este pedido está cancelado y no puede modificarse.';
          lockedMsg.style = 'background:#ffe0e0;color:#b00;padding:10px 18px;margin-bottom:12px;border-radius:6px;font-weight:bold;text-align:center;';
          form.parentNode.insertBefore(lockedMsg, form);
        }
      }
    });
    // Cambiar el texto del botón submit a "Modificar"
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Modificar';
    // Cambiar el submit para actualizar en vez de crear
    form.onsubmit = function(e) {
      e.preventDefault();
      mostrarModalPasswordEdicion(function(contrasena) {
        if (!contrasena) return; // Si se cancela, no continuar
        modificarPedido(contrasena);
      });
    };

    // Nueva función para modificar el pedido (solo si la contraseña fue correcta y no se canceló nada)
    function modificarPedido(contrasena) {
      // Validar artículos
      for (const item of items) {
        if (!item.nombre || item.cantidad <= 0 || item.valorU < 0) {
          messageDiv.textContent = 'Complete correctamente los datos de los artículos.';
          messageDiv.style.color = 'red';
          return;
        }
        
        // FORZAR ACTUALIZACIÓN de todos los campos desde Google Sheets antes de guardar
        if (item.nombre && articulosPorNombre[item.nombre]) {
          const art = articulosPorNombre[item.nombre];
          // Forzar actualización de codigo, codigoBarras, categoria y seleccionado
          item.codigo = art[2] || '';
          item.codigoBarras = art[11] || '';
          item.categoria = art[0] || '';
          item.seleccionado = art[9] || '';
          // Forzar actualización de valorC
          let valorCRaw = art[7] || '0';
          valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
          item.valorC = parseInt(valorCRaw) || 0;
        } else {
          // Si no hay artículo válido, limpiar campos
          item.codigo = '';
          item.codigoBarras = '';
          item.categoria = '';
          item.seleccionado = '';
          item.valorC = 0;
        }
        
        // Asegurar que valorC nunca sea undefined (fallback adicional)
        if (typeof item.valorC === 'undefined' || item.valorC === null) {
          item.valorC = 0;
        }
        
        // Calcular valorG
        item.valorG = (item.valorU - item.valorC) * (item.cantidad || 1);
      }
      // Procesar y guardar subtotal y total como enteros (solo dígitos)
      function onlyDigits(str) {
        return (str + '').replace(/\D/g, '');
      }
      const subtotal = parseInt(onlyDigits(form.subtotal.value), 10) || 0;
      const totalFinal = parseInt(onlyDigits(form.totalFinal.value), 10) || 0;
      const recargo = parseInt(onlyDigits(form.recargo.value), 10) || 0;
      const descuento = parseInt(onlyDigits(form.descuento.value), 10) || 0;
      const envio = parseInt(onlyDigits(form.envio.value), 10) || 0;
      const nota = form.nota ? form.nota.value.trim() : '';
      const vendedor = form.vendedor ? form.vendedor.value.trim() : '';
      const alias = form.alias ? form.alias.value.trim().toUpperCase() : '';
      
      // Validar ALIAS si el medio de pago es Transferencia o Parcial
      if ((form.medioPago.value === 'Transferencia' || form.medioPago.value === 'Parcial') && !alias) {
        messageDiv.textContent = 'Debe completar el campo ALIAS para transferencias y pagos parciales.';
        messageDiv.style.color = 'red';
        return;
      }
      
      // Obtener cotización blue en tiempo real
      fetch('https://api.bluelytics.com.ar/v2/latest')
        .then(r => r.json())
        .then(d => {
          let cotizacionCierre = (d.blue.value_sell || d.blue.sell) + 10;
          const costos = calcularCostos();
          // Determinar tipo de entrega
          let entrega = 'Local';
          if (form.direccion.value.trim() && form.direccion.value.trim().length > 7) {
            entrega = 'Envios';
          }
          // Calcular gananciaSelec: suma de valorG de los artículos seleccionados
          const gananciaSelec = items
            .filter(it => it.seleccionado && it.seleccionado.toUpperCase() === 'SI')
            .reduce((acc, it) => acc + (parseInt(it.valorG) || 0), 0);
          const pedidoObj = {
            timestamp: Date.now(),
            locked: true,
            adminViewed: true,
            cliente: { nombre: form.nombre.value.trim(), telefono: form.telefono.value.trim(), direccion: form.direccion.value.trim(), dni: form.dni.value.trim(), email: form.email.value.trim().toLowerCase(), tipoCliente: document.querySelector('input[name="tipoCliente"]:checked')?.value || '' },
            items: items.map(it => ({ codigo: it.codigo, codigoBarras: it.codigoBarras, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC, categoria: it.categoria, seleccionado: it.seleccionado, valorG: it.valorG })),
            pagos: {
              medioPago: form.medioPago.value,
              recargo,
              descuento,
              envio,
              subtotal,
              totalFinal,
              costos,
              ganancia: subtotal - costos - descuento,
              gananciaSelec,
              alias
            },
            status: 'DESPACHADO/ENTREGADO',
            cotizacionCierre: cotizacionCierre,
            costoUSD: costos / cotizacionCierre,
            createdby: 'admin',
            entrega,
            nota,
            vendedor,
            lastOrderUpdate: contrasena
          };
          // CONSERVAR fecha original si existe
          db.ref('pedidos/' + pedidoId).once('value').then(snap => {
            const pedido = snap.val();
            if (pedido && pedido.fecha) {
              pedidoObj.fecha = pedido.fecha;
            }
            db.ref('pedidos/' + pedidoId).set(pedidoObj)
              .then(() => {
                // Registrar movimientos de inventario también en edición
                registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoId);
                // Actualizar historial de alias si se usó uno
                if (pedidoObj.pagos && pedidoObj.pagos.alias && pedidoObj.pagos.alias.trim() !== '') {
                  cargarHistorialAlias();
                }
                // Mostrar modal de impresión DESPUÉS de actualizar exitosamente
                mostrarModalImprimirOrden(
                  function() { // Sí imprimir
                    generarReciboYImprimir();
                    messageDiv.textContent = 'Pedido actualizado correctamente.';
                    messageDiv.style.color = 'green';
                    setTimeout(() => {
                      if (window.opener && !window.opener.closed) {
                        window.opener.location.reload();
                        window.close();
                      } else {
                        window.location.href = 'ingresoPedido.html';
                      }
                    }, 1200);
                  },
                  function() { // No imprimir
                    messageDiv.textContent = 'Pedido actualizado correctamente.';
                    messageDiv.style.color = 'green';
                    setTimeout(() => {
                      if (window.opener && !window.opener.closed) {
                        window.opener.location.reload();
                        window.close();
                      } else {
                        window.location.href = 'ingresoPedido.html';
                      }
                    }, 1200);
                  }
                );
              })
              .catch(err => {
                messageDiv.textContent = 'Error al actualizar el pedido.';
                messageDiv.style.color = 'red';
              });
          });
        })
        .catch(() => {
          messageDiv.textContent = 'No se pudo obtener la cotización del dólar blue.';
          messageDiv.style.color = 'red';
        });
    }
  }

  // Hacer campos de cliente solo lectura (excepto nombre)
  form.telefono.readOnly = true;
  form.direccion.readOnly = true;
  form.dni.readOnly = true;
  form.email.readOnly = true;

  // Botón Editar Cliente
  const editarClienteBtn = document.getElementById('editarClienteBtn');
  if (editarClienteBtn) {
    editarClienteBtn.onclick = function() {
      // Obtener datos actuales del formulario
      const nombre = form.nombre.value.trim();
      const telefono = form.telefono.value.trim();
      const direccion = form.direccion.value.trim();
      const dni = form.dni.value.trim();
      const email = form.email.value.trim();
      let tipoCliente = 'consumidor final';
      const tipoRadio = document.querySelector('input[name="tipoCliente"]:checked');
      if (tipoRadio) tipoCliente = tipoRadio.value;
      mostrarModalRegistroCliente(nombre, telefono, direccion, dni, email, tipoCliente, true);
      // Forzar display flex para asegurar que el modal esté visible
      const modal = document.getElementById('modalRegistroCliente');
      if (modal) modal.style.display = 'flex';
    };
    // Soporte teclado: Enter abre modal, Escape cierra modal si está abierto o blurea el botón
    editarClienteBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        editarClienteBtn.click();
      } else if (e.key === 'Escape') {
        // Si el modal está abierto, ciérralo
        const modal = document.getElementById('modalRegistroCliente');
        if (modal && (modal.style.display === 'flex' || modal.style.display === '')) {
          const cancelarBtn = modal.querySelector('#cancelarNuevoCliente');
          if (cancelarBtn) cancelarBtn.click();
        } else {
          // Si no hay modal, blurea el botón
          editarClienteBtn.blur();
        }
      }
    });
  }

  // Detectar cambio de medio de pago y aplicar recargo automático si corresponde
  function actualizarRecargoAutomatico() {
    if (form.medioPago.value === 'MercadoPago') {
      let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
      let recargo = Math.round(subtotal * 0.06);
      recargoInput.value = recargo.toLocaleString('es-AR', {maximumFractionDigits:0});
      // recargoInput.readOnly = true; // Ahora siempre editable
    } else if (form.medioPago.value === 'Transferencia') {
      let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
      let recargo = Math.round(subtotal * 0.03);
      recargoInput.value = recargo.toLocaleString('es-AR', {maximumFractionDigits:0});
      // recargoInput.readOnly = true; // Ahora siempre editable
    } else {
      // recargoInput.readOnly = false; // Siempre editable
      recargoInput.value = '';
    }
  }

  form.medioPago.addEventListener('change', function() {
    actualizarRecargoAutomatico();
    calcularTotalFinal();
  });

  // Actualizar recargo automáticamente si está MercadoPago o Transferencia y cambia el subtotal
  function recalcularYActualizarRecargoSiMedioPago() {
    const medioPago = form.medioPago.value;
    if (medioPago === 'MercadoPago' || medioPago === 'Transferencia') {
      actualizarRecargoAutomatico();
      calcularTotalFinal();
    }
  }

  // === OPTIMIZACIÓN: DEBOUNCE PARA RECARGO ===
  let recargoTimeout;
  function debouncedRecargoUpdate() {
    clearTimeout(recargoTimeout);
    recargoTimeout = setTimeout(recalcularYActualizarRecargoSiMedioPago, 100);
  }

  // Llamar a la función después de cada cambio relevante solo si es necesario
  // Al modificar descuentos/envío (mantener directo)
  [recargoInput, descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', function() {
      // Normalizar y formatear
      let val = this.value.replace(/\D/g, '');
      // Formatear con punto como separador de miles
      this.value = val ? Number(val).toLocaleString('es-AR').replace(/,/g, '.') : '';
      calcularTotalFinal();
    });
  });

  // === Calcular Costos ===
  let costosCache = null;
  let lastItemsHash = '';
  
  function calcularCostos() {
    // Crear hash simple de los items para detectar cambios
    const currentHash = items.map(item => `${item.nombre}-${item.cantidad}`).join('|');
    
    if (costosCache !== null && lastItemsHash === currentHash) {
      return costosCache;
    }
    
    let costos = 0;
    items.forEach(item => {
      if (item.nombre && articulosPorNombre[item.nombre]) {
        const art = articulosPorNombre[item.nombre];
        // Usar valorC que ya está calculado en el item
        costos += (item.valorC || 0) * (item.cantidad || 0);
      }
    });
    
    costosCache = costos;
    lastItemsHash = currentHash;
    return costos;
  }

  // === CLIENTES: Autocompletar y registro ===
let clientesRegistrados = [];
let clientesPorNombre = {};

// Crear datalist para autocompletar nombre
let datalistClientes = document.getElementById('clientesDatalist');
if (!datalistClientes) {
  datalistClientes = document.createElement('datalist');
  datalistClientes.id = 'clientesDatalist';
  document.body.appendChild(datalistClientes);
}
form.nombre.setAttribute('list', 'clientesDatalist');

// Cargar clientes desde Firebase
function cargarClientes() {
  db.ref('clientes').once('value').then(snap => {
    clientesRegistrados = [];
    clientesPorNombre = {};
    datalistClientes.innerHTML = '';
    snap.forEach(child => {
      const cli = child.val();
      if (cli && cli.nombre) {
        clientesRegistrados.push(cli);
        clientesPorNombre[cli.nombre.toLowerCase()] = cli;
        const opt = document.createElement('option');
        opt.value = cli.nombre;
        datalistClientes.appendChild(opt);
      }
    });
  });
}
cargarClientes();

// === ALIAS: Autocompletar con historial ===
let aliasHistorial = [];

// Crear datalist para autocompletar alias
let datalistAlias = document.getElementById('aliasDatalist');
if (!datalistAlias) {
  datalistAlias = document.createElement('datalist');
  datalistAlias.id = 'aliasDatalist';
  document.body.appendChild(datalistAlias);
}

// Configurar el campo alias para usar el datalist
const aliasField = document.getElementById('alias');
if (aliasField) {
  aliasField.setAttribute('list', 'aliasDatalist');
}

// Cargar historial de alias desde Firebase
function cargarHistorialAlias() {
  db.ref('pedidos').orderByChild('timestamp').limitToLast(200).once('value').then(snap => {
    const aliasSet = new Set(); // Para evitar duplicados
    const pedidos = [];
    
    // Convertir snapshot a array y ordenar por timestamp descendente
    snap.forEach(child => {
      const pedido = child.val();
      if (pedido && pedido.pagos && pedido.pagos.alias && pedido.pagos.alias.trim() !== '') {
        pedidos.push({
          alias: pedido.pagos.alias.trim().toUpperCase(),
          timestamp: pedido.timestamp || 0
        });
      }
    });
    
    // Ordenar por timestamp descendente y tomar solo los 10 más recientes únicos
    pedidos.sort((a, b) => b.timestamp - a.timestamp);
    
    aliasHistorial = [];
    pedidos.forEach(pedido => {
      if (aliasSet.size < 10 && !aliasSet.has(pedido.alias)) {
        aliasSet.add(pedido.alias);
        aliasHistorial.push(pedido.alias);
      }
    });
    
    // Actualizar datalist
    datalistAlias.innerHTML = '';
    aliasHistorial.forEach(alias => {
      const option = document.createElement('option');
      option.value = alias;
      datalistAlias.appendChild(option);
    });
  }).catch(err => {
    console.error('Error cargando historial de alias:', err);
  });
}

// Cargar historial de alias al inicializar
cargarHistorialAlias();

// Al salir del input nombre, validar si existe
form.nombre.addEventListener('blur', function() {
  const nombre = form.nombre.value.trim().toLowerCase();
  if (!nombre) return;
  if (clientesPorNombre[nombre]) {
    // Autocompletar datos
    const cli = clientesPorNombre[nombre];
    form.telefono.value = cli.telefono || '';
    form.direccion.value = cli.direccion || '';
    form.dni.value = cli.dni || '';
    form.email.value = cli.email || '';
    // Restaurar tipoCliente si existe
    if (cli.tipoCliente) {
      const radio = document.querySelector(`input[name="tipoCliente"][value="${cli.tipoCliente}"]`);
      if (radio) radio.checked = true;
      tipoCliente = cli.tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
    }
  } else {
    // Mostrar modal para registrar cliente
    mostrarModalRegistroCliente(form.nombre.value.trim());
  }
});

// Modal vistoso para registrar o editar cliente
function mostrarModalRegistroCliente(nombrePrellenado = '', telefonoPrellenado, direccionPrellenado, dniPrellenado, emailPrellenado, tipoClientePrellenado = 'mayorista', esEdicion = false) {
  let modal = document.getElementById('modalRegistroCliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRegistroCliente';
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;">
        <div style="background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 4px 32px #0002;min-width:320px;max-width:90vw;">
          <h2 style='color:#6c4eb6;margin-bottom:16px;'>${esEdicion ? 'Editar cliente' : 'Registrar nuevo cliente'}</h2>
          <form id='formNuevoCliente'>
            <div style='margin-bottom:10px;'><input type='text' name='nombre' placeholder='Nombre' required style='width:95%;padding:8px;' value="${nombrePrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='telefono' placeholder='Teléfono' style='width:95%;padding:8px;' value="${telefonoPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='direccion' placeholder='Dirección' style='width:95%;padding:8px;' value="${direccionPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='dni' placeholder='DNI' style='width:95%;padding:8px;' value="${dniPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='email' name='email' placeholder='Email' style='width:95%;padding:8px;' value="${emailPrellenado||''}"></div>
            <div style='margin-bottom:10px;display:flex;align-items:center;gap:10px;'>
              <label style='font-weight:bold;'>Tipo de Cliente:</label>
              <label style='margin-left:10px;'><input type='radio' name='tipoClienteModal' value='consumidor final' ${tipoClientePrellenado === 'consumidor final' ? 'checked' : ''}> Consumidor</label>
              <label style='margin-left:10px;'><input type='radio' name='tipoClienteModal' value='mayorista' ${tipoClientePrellenado === 'mayorista' ? 'checked' : ''}> Mayorista</label>
            </div>
            <div style='display:flex;gap:10px;justify-content:flex-end;'>
              <button type='button' id='cancelarNuevoCliente' style='background:#eee;color:#333;padding:8px 16px;border:none;border-radius:4px;'>Cancelar</button>
              <button type='submit' style='background:#6c4eb6;color:#fff;padding:8px 16px;border:none;border-radius:4px;'>${esEdicion ? 'Guardar' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
    modal.querySelector('input[name="nombre"]').value = nombrePrellenado||'';
    if (typeof telefonoPrellenado !== 'undefined') modal.querySelector('input[name="telefono"]').value = telefonoPrellenado||'';
    if (typeof direccionPrellenado !== 'undefined') modal.querySelector('input[name="direccion"]').value = direccionPrellenado||'';
    if (typeof dniPrellenado !== 'undefined') modal.querySelector('input[name="dni"]').value = dniPrellenado||'';
    if (typeof emailPrellenado !== 'undefined') modal.querySelector('input[name="email"]').value = emailPrellenado||'';
    const tipoClienteRadio = modal.querySelectorAll('input[name="tipoClienteModal"]');
    tipoClienteRadio.forEach(radio => {
      radio.checked = (radio.value === tipoClientePrellenado);
    });
    // Cambiar título y botón
    modal.querySelector('h2').textContent = esEdicion ? 'Editar cliente' : 'Registrar nuevo cliente';
    modal.querySelector('button[type="submit"]').textContent = esEdicion ? 'Guardar' : 'Registrar';
  }
  // Cancelar
  modal.querySelector('#cancelarNuevoCliente').onclick = function() {
    modal.remove();
    cleanup();
  };
  // Registrar/Guardar
  modal.querySelector('#formNuevoCliente').onsubmit = function(e) {
    e.preventDefault();
    const nombre = this.nombre.value.trim();
    let tipoCliente = 'consumidor final';
    const tipoRadio = this.querySelector('input[name="tipoClienteModal"]:checked');
    if (tipoRadio) tipoCliente = tipoRadio.value;
    if (!nombre || !tipoCliente) return;
    // Si es edición, actualiza el cliente en Firebase si existe
    if (esEdicion) {
      // Buscar el cliente por nombre (case-insensitive)
      const nombreKey = nombre.toLowerCase();
      let clienteId = null;
      let clienteEncontrado = null;
      // Buscar el id del cliente en el snapshot cargado
      db.ref('clientes').once('value').then(snap => {
        snap.forEach(child => {
          const cli = child.val();
          if (cli && cli.nombre && cli.nombre.toLowerCase() === nombreKey) {
            clienteId = child.key;
            clienteEncontrado = cli;
          }
        });
        if (clienteId) {
          db.ref('clientes/' + clienteId).update({ nombre, telefono: this.telefono.value.trim(), direccion: this.direccion.value.trim(), dni: this.dni.value.trim(), email: this.email.value.trim(), tipoCliente })
            .then(() => {
              cargarClientes();
              form.nombre.value = nombre;
              form.telefono.value = this.telefono.value.trim();
              form.direccion.value = this.direccion.value.trim();
              form.dni.value = this.dni.value.trim();
              form.email.value = this.email.value.trim();
              if (tipoCliente) {
                const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
                if (radio) radio.checked = true;
                tipoCliente = tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
              }
              modal.remove();
            });
        } else {
          // Si no existe, solo actualiza el formulario
          form.nombre.value = nombre;
          form.telefono.value = this.telefono.value.trim();
          form.direccion.value = this.direccion.value.trim();
          form.dni.value = this.dni.value.trim();
          form.email.value = this.email.value.trim();
          if (tipoCliente) {
            const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
            if (radio) radio.checked = true;
            tipoCliente = tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
          }
          modal.remove();
        }
      });
      return;
    }
    // Guardar en Firebase
    db.ref('clientes').push({ nombre, telefono: this.telefono.value.trim(), direccion: this.direccion.value.trim(), dni: this.dni.value.trim(), email: this.email.value.trim(), tipoCliente, registro: 'Local' })
      .then(() => {
        cargarClientes();
        form.nombre.value = nombre;
        form.telefono.value = this.telefono.value.trim();
        form.direccion.value = this.direccion.value.trim();
        form.dni.value = this.dni.value.trim();
        form.email.value = this.email.value.trim();
        if (tipoCliente) {
          const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
          if (radio) radio.checked = true;
        }
        modal.remove();
      });
  };
  // Soporte Enter/Escape
  function keyHandler(e) {
    if (modal.style.display !== 'flex') return;
    // Solo confirmar con Enter si el foco está en un input o textarea
    if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') {
      modal.querySelector('button[type="submit"]').click();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      modal.querySelector('#cancelarNuevoCliente').click();
      e.preventDefault();
    }
  }
  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
  }
  document.addEventListener('keydown', keyHandler);
}

// Botón Imprimir
  const imprimirBtn = document.querySelector('.actions button.secondary');
  if (imprimirBtn) {
    imprimirBtn.addEventListener('click', function() {
      generarReciboYImprimir();
    });
  }

  function generarReciboYImprimir() {
    // Obtener datos del formulario
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim();
    const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value || '';
    const medioPago = form.medioPago.value;
    const alias = form.alias ? form.alias.value.trim().toUpperCase() : '';
    const subtotal = form.subtotal.value;
    const recargo = form.recargo.value;
    const descuento = form.descuento.value;
    const envio = form.envio.value;
    const totalFinal = form.totalFinal.value;
    // Items
    let itemsHtml = '';
    items.forEach(it => {
      itemsHtml += `<tr><td>${it.codigo||''}</td><td>${it.nombre||''}</td><td style='text-align:right;'>${it.cantidad||''}</td><td style='text-align:right;'>${it.valorU||''}</td><td style='text-align:right;'>${(it.cantidad*it.valorU)||''}</td></tr>`;
    });
    // Recibo HTML
    const reciboHtml = `
      <html>
      <head>
        <title>Orden de Pedido</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; color: #111; background: #fff; }
          .recibo-box { margin: 0 auto; border: 1px dashed #333; padding: 24px 18px; background: #fff; }
          h2 { text-align: left; font-size: 1.3em; margin: 0 0 12px 0; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border-bottom: 1px dotted #aaa; padding: 4px 2px; font-size: 0.90em; }
          th { background: #eee; font-weight: bold; text-align: left; }
          .totales td { border: none; font-weight: bold; }
          .label { width: 110px; display: inline-block; }
          @media print { button { display: none !important; } }
        </style>
      </head>
      <body>
        <div class='recibo-box'>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h2 style="margin:0;">Orden de Pedido</h2>
            <img src="logo.png" alt="Logo" style="height:48px;max-width:180px;object-fit:contain;">
          </div>
          <div style="font-size:0.90em; margin-bottom: 5px;">${new Date().toLocaleString('es-AR', { hour12: false })}</div>
          <div><span class='label'>Nombre:</span> ${nombre}</div>
          <div><span class='label'>Teléfono:</span> ${telefono}</div>
          <div><span class='label'>Dirección:</span> ${direccion}</div>
          <div><span class='label'>DNI:</span> ${dni}</div>
          <div><span class='label'>Email:</span> ${email}</div>
          <div><span class='label'>Tipo:</span> ${tipoCliente}</div>
          <hr style='margin:10px 0;'>
          <table>
            <thead>
              <tr><th>Cod</th><th>Artículo</th><th>Cant</th><th>Valor</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <table>
            <tr class='totales'><td>Subtotal</td><td style='text-align:right;'>${subtotal}</td></tr>
            <tr class='totales'><td>Medio de Pago</td><td style='text-align:right;'>${medioPago}</td></tr>
            <tr class='totales'><td>Recargo</td><td style='text-align:right;'>${recargo}</td></tr>
            <tr class='totales'><td>Descuento</td><td style='text-align:right;'>${descuento}</td></tr>
            <tr class='totales'><td>Costo de Envío</td><td style='text-align:right;'>${envio}</td></tr>
            <tr class='totales'><td>Total</td><td style='text-align:right;font-size:1.1em;'>${totalFinal}</td></tr>
          </table>
        </div>
        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `;
    // Abrir ventana e imprimir
    const w = window.open('', '_blank', 'width=600,height=800');
    w.document.write(reciboHtml);
    w.document.close();
  }

  // Inicializar tabla vacía
  renderItems();

  // Mostrar/ocultar alias y comprobante de transferencia según medio de pago
  function actualizarVisibilidadComprobanteTransferencia() {
    const aliasRow = document.getElementById('aliasRow');
    if (!aliasRow) return;
    if (form.medioPago.value === 'Transferencia' || form.medioPago.value === 'Parcial') {
      aliasRow.style.display = '';
    } else {
      aliasRow.style.display = 'none';
    }
  }
  // Ejecutar al cargar
  actualizarVisibilidadComprobanteTransferencia();
  // Ejecutar al cambiar medio de pago
  form.medioPago.addEventListener('change', actualizarVisibilidadComprobanteTransferencia);

  // === CONVERTIR ALIAS A MAYÚSCULAS ===
  const aliasInput = document.getElementById('alias');
  if (aliasInput) {
    aliasInput.addEventListener('input', function() {
      // Guardar la posición del cursor
      const start = this.selectionStart;
      const end = this.selectionEnd;
      // Convertir a mayúsculas
      this.value = this.value.toUpperCase();
      // Restaurar la posición del cursor SOLO si no es tipo number
      if (this.type !== 'number') {
        this.setSelectionRange(start, end);
      }
    });
  }

  // === MODAL CONTRASEÑA PARA MODIFICAR PEDIDO ===
  // Agregar estilos para el modal de contraseña (extraído del HTML de eliminación)
  const styleModalPassword = document.createElement('style');
  styleModalPassword.innerHTML = `
    #modalPassword {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.3);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    #modalPassword > div {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      min-width: 300px;
      box-shadow: 0 2px 16px #0002;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #modalPassword input[type="password"] {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      margin-bottom: 16px;
      width: 100%;
    }
    #modalPassword .modal-btns {
      display: flex;
      gap: 10px;
    }
    #modalPassword .modal-btns button {
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
    }
    #modalPassword .modal-btns .eliminar {
      background: #f44336;
    }
    #modalPassword .modal-btns .cancelar {
      background: #888;
    }
    #modalPassword .msg-error {
      color: #f44336;
      margin-top: 10px;
      display: none;
    }
  `;
  document.head.appendChild(styleModalPassword);

  function mostrarModalPasswordEdicion(onConfirm) {
    let modal = document.getElementById('modalPassword');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalPassword';
      modal.innerHTML = `
        <div>
          <h3 style="color:#4b2e83; margin-bottom:16px;">Confirmar modificación</h3>
          <p style="margin-bottom:12px; color:#333;">Ingrese la contraseña para modificar el pedido:</p>
          <input id="inputPasswordEdicion" type="password" placeholder="Contraseña">
          <div class="modal-btns">
            <button id="btnConfirmarEdicion" class="eliminar">Modificar</button>
            <button id="btnCancelarEdicion" class="cancelar">Cancelar</button>
          </div>
          <span id="msgPasswordErrorEdicion" class="msg-error">Contraseña incorrecta</span>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
      modal.querySelector('#inputPasswordEdicion').value = '';
      modal.querySelector('#msgPasswordErrorEdicion').style.display = 'none';
    }
    modal.style.display = 'flex';
    const input = modal.querySelector('#inputPasswordEdicion');
    input.focus();
    // Bandera para evitar doble ejecución
    let accionRealizada = false;
    function keyHandler(e) {
      if (modal.style.display !== 'flex') return;
      if (e.key === 'Enter') {
        modal.querySelector('#btnConfirmarEdicion').click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        modal.querySelector('#btnCancelarEdicion').click();
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', keyHandler);
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    modal.querySelector('#btnConfirmarEdicion').onclick = function() {
      if (accionRealizada) return;
      const pass = input.value;
      if (pass !== '3469' && pass !== '1234') {
        modal.querySelector('#msgPasswordErrorEdicion').style.display = 'block';
        return; // Detener aquí, no llamar onConfirm
      }
      accionRealizada = true;
      modal.style.display = 'none';
      cleanup();
      onConfirm(pass);
    };
    modal.querySelector('#btnCancelarEdicion').onclick = function() {
      if (accionRealizada) return;
      accionRealizada = true;
      modal.style.display = 'none';
      cleanup();
      // No llamar onConfirm, solo cerrar y detener
    };
  }

  // --- REGISTRO DE MOVIMIENTOS DE INVENTARIO ---
  function registrarMovimientosInventario(items, cotizacionCierre, pedidoId) {
    if (!Array.isArray(items) || !cotizacionCierre || !pedidoId) return;
    // 1. Eliminar movimientos previos de este pedido (por pedidoId)
    db.ref('movimientos').orderByChild('pedidoId').equalTo(pedidoId).once('value', function(snapshot) {
      const updates = {};
      snapshot.forEach(child => {
        updates[child.key] = null;
      });
      if (Object.keys(updates).length > 0) {
        db.ref('movimientos').update(updates).catch(err => {
          console.error('Error eliminando movimientos previos:', err, updates);
        });
      }
      // 2. Registrar los nuevos movimientos
      items.forEach((item) => {
        try {
          if (!item || !item.codigo || !item.nombre || !item.cantidad || !item.valorU) return;
          const timestamp = Date.now();
          const now = new Date();
          const pad = n => n.toString().padStart(2, '0');
          const id = `mov_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${item.codigo}_${pedidoId}`;
          const movimiento = {
            timestamp: timestamp,
            codigo: item.codigo,
            nombre: item.nombre,
            cantidad: parseInt(item.cantidad, 10) || 0,
            tipo: 'SALIDA',
            pedidoId: pedidoId
          };
          db.ref('movimientos/' + id).set(movimiento)
            .catch(err => {
              console.error('Error registrando movimiento de inventario:', err, movimiento);
            });
        } catch (err) {
          console.error('Error inesperado al registrar movimiento de inventario:', err, item);
        }
      });
    });
  }
});
