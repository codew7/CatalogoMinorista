
        //const WHATSAPP_URL = "https://api.whatsapp.com/send/?phone=5491121891006"; // MAYORISTA
        const WHATSAPP_URL = "https://api.whatsapp.com/send/?phone=5491154597288"; // MINORISTA

        //const MARQUEE_TEXT = "💲&nbsp; Valores publicados en dólares o cotización al Blue del día &nbsp;💲 - &nbsp; 🛒 &nbsp; COMPRA MINIMA: 4 articulos iguales o $100.000 en varios distintos &nbsp; 🛍️ &nbsp; - &nbsp; 🚚 &nbsp; ENVÍOS A TODO EL PAÍS &nbsp; 📦"; // MAYORISTA
        const MARQUEE_TEXT = "🏪  Visita nuestro Showroom en Vicente López  🛍️    -    🚚  ENVÍOS A TODO EL PAÍS  📦"; // MINORISTA

        //const ITEMPESOS = "6"; // MAYORISTA
        const ITEMPESOS = "4"; // MINORISTA

        //-- Verifica Login MAYORISTA --//
        // window.addEventListener('DOMContentLoaded', (event) => {
        // const usuarioLogueado = localStorage.getItem('usuarioLogueado');
        // if (!usuarioLogueado) {
        //     window.location.href = 'index.html';  // Redirige al login si no está logueado
        // }});
        

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-4KVPQ6RYRQ');

        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-5P63433D');

        // Mostrar el acceso mayorista solo si ITEMPESOS es "4"
        if (typeof ITEMPESOS !== "undefined" && ITEMPESOS === "4") {
            document.write(`
        <div style="text-align: center; font-size: 14px; font-style: italic; width: 100%; display: flex; justify-content: center; align-items: center; gap: 10px; margin: 15px 0;">
            Acceso Mayorista
            <button onclick="window.location.href='https://home-point.com.ar/mayorista'" style="padding: 5px 10px; font-size: 12px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; width: auto;">Login</button>
        </div>
            `);
        }

    const carouselImages = document.getElementById('carousel-images');
    const images = document.querySelectorAll('#carousel-images img');
    let currentIndex = 0;

    function updateCarousel() {
        const offset = -currentIndex * 100;
        carouselImages.style.transform = `translateX(${offset}%)`;
    }

    setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        updateCarousel();
    }, 5000); // Cambiar imagen cada 5 segundos

        const API_KEY = 'AIzaSyDwiZWDc66tv4usDIA-IreiJMLFuk0236Q';
        const SPREADSHEET_ID = '1cD50d0-oSTogEe9tYo9ABUSP1ONCy3SAV92zsYYIG84';
        const RANGO = 'A2:G';
        const ITEMS_PER_PAGE = 30;

        let productos = [];
        let currentPage = 1;
        let carrito = [];
        let currentLightboxImages = [];
        let currentImageIndex = 0;

        const loadingMessage = document.getElementById('loading-message');

        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGO}?key=${API_KEY}`)
            .then(response => {
                if (!response.ok) throw new Error(`Error al acceder a la API: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                loadingMessage.style.display = 'none'; // Ocultar el mensaje de carga
                const items = data.values;
                if (!items || items.length === 0) throw new Error("No se encontraron datos en la hoja.");
                
                // Filtrar para ocultar artículos con etiqueta "No disponible"
                // y ordenar descendente por el código (índice 2)
                productos = items
                    .filter(item => item[4].toLowerCase() !== 'no disponible') //FILTRAR NO DISPONIBLE
                    .sort((a, b) => parseInt(b[2]) - parseInt(a[2]));
                
                mostrarPagina(1);

                // Usar la lista filtrada para obtener categorías
                const categoriasSet = new Set(productos.map(item => item[0]));
                const selectCategorias = document.getElementById('categorias');
                categoriasSet.forEach(categoria => {
                    const option = document.createElement('option');
                    option.value = categoria;
                    option.textContent = categoria;
                    selectCategorias.appendChild(option);
                });

                selectCategorias.addEventListener('change', () => {
                    const categoria = selectCategorias.value;
                    if (categoria === "todos") {
                        mostrarPagina(1);
                    } else {
                        const filtrados = productos.filter(item => item[0] === categoria);
                        mostrarPagina(1, filtrados);
                    }
                });

                document.getElementById('buscar').addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const filtrados = productos.filter(item => 
                        item[3].toLowerCase().includes(query) || item[2].toLowerCase().includes(query)
                    );
                    mostrarPagina(1, filtrados);
                });

                document.getElementById('novedades').addEventListener('click', () => {
                    const novedades = [...productos].sort((a, b) => parseInt(b[2]) - parseInt(a[2]));
                    actualizarPaginacion(1, novedades);
                    cargarGrid(novedades.slice(0, ITEMS_PER_PAGE));
                });

                document.getElementById('todos').addEventListener('click', () => {
                    mostrarPagina(1);
                });
            })
            .catch(error => {
                loadingMessage.style.display = 'none'; // Ocultar el mensaje de carga en caso de error
                console.error('Error al cargar los datos:', error);
                document.querySelector('#error').textContent = error.message;
            });

        function mostrarPagina(pagina, datos = productos) {
            currentPage = pagina;
            const totalPaginas = Math.ceil(datos.length / ITEMS_PER_PAGE);
            const inicio = (pagina - 1) * ITEMS_PER_PAGE;
            const fin = inicio + ITEMS_PER_PAGE;
            const datosPagina = datos.slice(inicio, fin);

            cargarGrid(datosPagina);
            actualizarPaginacion(pagina, datos);
			
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function cargarGrid(data) {
            const grid = document.getElementById('catalogo');
            grid.innerHTML = '';

            data.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('card');

            const articulo = document.createElement('h3');
            articulo.textContent = item[3];
            card.appendChild(articulo);

            if (isValidImageUrl(item[1])) {
                let imageUrls = [];
                if (item[1].indexOf(',') !== -1) {
                imageUrls = item[1].split(',').map(url => url.trim());
                } else {
                imageUrls.push(item[1]);
                }
                
                const img = document.createElement('img');
                img.src = imageUrls[0];
                img.loading = 'lazy'; // Agregar lazy loading
                img.onerror = function() {
                    this.src = 'no-disponible.png'; // Imagen de respaldo
                };
                img.addEventListener('click', () => {
                    abrirLightbox(imageUrls);
                });
                card.appendChild(img);
            }

            const info = document.createElement('div');
            info.classList.add('info');
            info.textContent = `Código: ${item[2]}`;
            card.appendChild(info);

            if (ITEMPESOS == "6") {
                const valorUSD = document.createElement('p');
                valorUSD.innerHTML = `<strong>Valor USD</strong> ${item[5]}`;
                card.appendChild(valorUSD);
            }

            const valorPesos = document.createElement('p');
            valorPesos.innerHTML = `<strong>Valor $</strong> ${item[ITEMPESOS]}`;
            card.appendChild(valorPesos);

            // Contenedor para el selector de cantidad y el botón
            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.alignItems = 'center';
            actionContainer.style.justifyContent = 'center';
            actionContainer.style.gap = '10px';

            // Selector de cantidad
            const cantidadSelector = document.createElement('input');
            cantidadSelector.type = 'number';
            cantidadSelector.min = '1';
            cantidadSelector.value = ''; // Por defecto vacío
            cantidadSelector.style.width = '35px';
            cantidadSelector.style.height = '35px';
            cantidadSelector.style.padding = '5px';
            actionContainer.appendChild(cantidadSelector);

            // Evento para actualizar la cantidad en el carrito al cambiar el selector
            cantidadSelector.addEventListener('change', () => {
                const nuevaCantidad = parseInt(cantidadSelector.value);
                if (!isNaN(nuevaCantidad) && nuevaCantidad > 0) {
                    const existe = carrito.find(item => item.nombre === articulo.textContent); // Usar el nombre del artículo
                    if (existe) {
                        existe.cantidad = nuevaCantidad; // Actualizar la cantidad en el carrito
                        actualizarCarrito(); // Refrescar el carrito
                    }
                }
            });

            // Botón para agregar el artículo al carrito
            const btnAgregar = document.createElement('button');
            btnAgregar.innerHTML = '<i class="fas fa-cart-plus"></i>';
            btnAgregar.style.padding = '10px 10px';  // Aumenta el espacio interno
            btnAgregar.style.fontSize = '16px';     // Aumenta el tamaño del texto
            btnAgregar.style.height = '50px';       // Ajusta la altura
            btnAgregar.style.width = '50px';        // Ajusta el ancho
            btnAgregar.addEventListener('click', () => {
                let cantidad = parseInt(cantidadSelector.value);
                if (isNaN(cantidad) || cantidad <= 0) {
                    // Si el selector está vacío o tiene un valor inválido, lo establecemos en 1
                    cantidad = 1;
                    cantidadSelector.value = '1';
                }

                const existe = carrito.find(item => item.nombre === articulo.textContent); // Usar el nombre del artículo
                if (existe) {
                    // Si el artículo ya existe, actualizamos la cantidad con el valor del selector
                    existe.cantidad = cantidad;
                } else {
                    // Si no existe, lo agregamos al carrito
                    agregarAlCarrito(articulo.textContent, item[5], cantidad);
                }

                actualizarCarrito(); // Refrescar el carrito
            });
            actionContainer.appendChild(btnAgregar);

            card.appendChild(actionContainer);
            grid.appendChild(card);
            });
        }

        function agregarAlCarrito(nombre, precio, cantidad) {
            const existe = carrito.find(item => item.nombre === nombre);
            if (existe) {
                // Si el artículo ya existe, actualizamos la cantidad
                existe.cantidad += cantidad;
            } else {
                // Si no existe, lo agregamos al carrito
                carrito.push({ nombre, precio, cantidad });
            }
            actualizarCarrito();
        }

        function actualizarPaginacion(paginaActual, datos) {
            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';

            const totalPaginas = Math.ceil(datos.length / ITEMS_PER_PAGE);

            // Botón "Anterior"
            if (paginaActual > 1) {
                const btnAnterior = document.createElement('button');
                btnAnterior.textContent = 'Anterior';
                btnAnterior.style.width = '100px';
                btnAnterior.addEventListener('click', () => mostrarPagina(paginaActual - 1, datos));
                pagination.appendChild(btnAnterior);
            }

            // Botones numerados
            const MAX_VISIBLE_BUTTONS = 5; // Máximo de botones visibles
            let startPage = Math.max(1, paginaActual - Math.floor(MAX_VISIBLE_BUTTONS / 2));
            let endPage = Math.min(totalPaginas, startPage + MAX_VISIBLE_BUTTONS - 1);

            if (endPage - startPage < MAX_VISIBLE_BUTTONS - 1) {
                startPage = Math.max(1, endPage - MAX_VISIBLE_BUTTONS + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
                const btnPagina = document.createElement('button');
                btnPagina.textContent = i;
                btnPagina.classList.add('pagination-button');
                if (i === paginaActual) {
                    btnPagina.classList.add('active'); // Clase para el botón activo
                }
                btnPagina.addEventListener('click', () => mostrarPagina(i, datos));
                pagination.appendChild(btnPagina);
            }

            // Botón "Siguiente"
            if (paginaActual < totalPaginas) {
                const btnSiguiente = document.createElement('button');
                btnSiguiente.textContent = 'Siguiente';
                btnSiguiente.style.width = '100px'; // Define el ancho del botón
                btnSiguiente.addEventListener('click', () => mostrarPagina(paginaActual + 1, datos));
                pagination.appendChild(btnSiguiente);
            }
        }

        function isValidImageUrl(url) {
            return url && url.match(/\.(jpeg|jpg|gif|png)$/i);
        }

        function abrirLightbox(images) {
            currentLightboxImages = images;
            currentImageIndex = 0;
            document.getElementById('lightbox-img').src = currentLightboxImages[currentImageIndex];
            document.getElementById('lightbox').style.display = 'flex';
            actualizarBotonesLightbox();
        }

        function actualizarBotonesLightbox() {
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            if (currentLightboxImages.length > 1) {
                prevBtn.style.display = 'block';
                nextBtn.style.display = 'block';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        }

        document.getElementById('next-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentLightboxImages.length > 0) {
                currentImageIndex = (currentImageIndex + 1) % currentLightboxImages.length;
                document.getElementById('lightbox-img').src = currentLightboxImages[currentImageIndex];
            }
        });

        document.getElementById('prev-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentLightboxImages.length > 0) {
                currentImageIndex = (currentLightboxImages.length + currentImageIndex - 1) % currentLightboxImages.length;
                document.getElementById('lightbox-img').src = currentLightboxImages[currentImageIndex];
            }
        });

        document.getElementById('lightbox-img').addEventListener('error', function() {
            // Si ocurre un error y no se trata de la primera imagen, mostramos la primera
            if (currentLightboxImages.length > 0 && currentImageIndex !== 0) {
                currentImageIndex = 0;
                this.src = currentLightboxImages[0];
            }
        });

        function closeLightbox(event) {
            if (event.target === event.currentTarget || event.target.classList.contains('close')) {
                document.getElementById('lightbox').style.display = 'none';
            }
        }

        // Funciones del carrito de compras

        // Verifica que el mismo artículo no se agregue más de una vez
        function agregarAlCarrito(nombre, precio, cantidad) {
            const existe = carrito.find(item => item.nombre === nombre);
            if (existe) {
                // Si el artículo ya existe, actualizamos la cantidad
                existe.cantidad += cantidad;
            } else {
                // Si no existe, lo agregamos al carrito
                carrito.push({ nombre, precio, cantidad });
            }
            actualizarCarrito();
        }

        function actualizarCarrito() {
            const cartList = document.getElementById('cart-list');
            const cartContainer = document.querySelector('.cart-container');

            cartList.innerHTML = '';

            if (carrito.length === 0) {
                cartContainer.style.display = 'none'; // Ocultar carrito si está vacío
            } else {
                cartContainer.style.display = 'block'; // Mostrar carrito si tiene artículos
            }

            carrito.forEach(item => {
                let li = document.createElement('li');
                li.textContent = `${item.nombre} - Cantidad: ${item.cantidad}`;
                cartList.appendChild(li);
            });
        }

        function enviarPedido() {
            if (carrito.length === 0) {
                alert("El carrito está vacío.");
                return;
            }
            let mensaje = "Hola, me interesan estos artículos:%0A";
            carrito.forEach(item => {
                mensaje += `- ${item.nombre} - Cantidad: ${item.cantidad}%0A`;
            });
            window.open(`${WHATSAPP_URL}&text=${mensaje}`);
        }
        
        function limpiarCarrito() {
            carrito = [];
            actualizarCarrito();
            // Vaciar todos los inputs de cantidad
            document.querySelectorAll('input[type="number"]').forEach(input => {
                input.value = '';
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('marquee-text').innerHTML = MARQUEE_TEXT;
        });


  document.addEventListener('click', function (e) {
    let el = e.target;

    // Subir hasta encontrar el <a> más cercano (por si clickean un <span> dentro del link)
    while (el && el.tagName !== 'A') {
      el = el.parentElement;
    }

    if (el && el.tagName === 'A') {
      const url = el.href;

      // Si el link es a WhatsApp con api.whatsapp.com/send/?phone=
      if (url.includes('https://api.whatsapp.com/send/?phone=')) {
        window.dataLayer = window.dataLayer || [];
        dataLayer.push({
          event: 'clickWhatsapp',
          whatsapp_url: url,
          whatsapp_text: el.innerText
        });
      }
    }
  });

